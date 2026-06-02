import sys
import json
import numpy as np
from scipy.optimize import minimize

def main():
    try:
        # Read JSON input from stdin
        input_data = json.loads(sys.stdin.read())
        
        stns = input_data.get('stns', [])
        exg = input_data.get('v_ex', [])
        target_limit = input_data.get('slew_limit', None)
        limit_in = input_data.get('max_slew_in', [])
        limit_out = input_data.get('max_slew_out', [])
        
        N = len(stns)
        if N < 5:
            print(json.dumps({"success": False, "error": f"Need at least 5 stations (found {N})"}))
            return
            
        v_ex = np.array(exg, dtype=float)
        
        # Identify active stations for optimization
        non_zero_indices = np.where(np.abs(v_ex) > 0)[0]
        if len(non_zero_indices) == 0:
            # If all are 0, proposed is all 0
            v_pro = np.zeros(N, dtype=int)
            print(json.dumps({
                "success": True,
                "v_pro": v_pro.tolist(),
                "slew": [0.0]*N,
                "max_slew": 0.0,
                "smoothness": 0.0,
                "limit_used": 0.0,
                "warning": "All existing versines were zero."
            }))
            return
            
        first_active = max(0, non_zero_indices[0] - 3)
        last_active = min(N - 1, non_zero_indices[-1] + 3)
        
        active_mask = np.zeros(N, dtype=bool)
        active_mask[first_active:last_active+1] = True
        active_indices = np.where(active_mask)[0]
        n_active = len(active_indices)
        
        # Optimization functions
        def objective(x_active):
            x = np.zeros(N)
            x[active_indices] = x_active
            return np.sum(np.diff(x, n=2)**2)

        def constr_sum(x_active):
            x = np.zeros(N)
            x[active_indices] = x_active
            return np.sum(x) - np.sum(v_ex)

        def constr_moment(x_active):
            x = np.zeros(N)
            x[active_indices] = x_active
            d = x - v_ex
            weights = np.arange(N, 0, -1)
            return np.sum(weights * d)

        def get_slew(x_active):
            x = np.zeros(N)
            x[active_indices] = x_active
            d = x - v_ex
            s = np.cumsum(d)
            m = np.cumsum(s)
            return -2 * m

        # Dynamic bounds for reverse/simple curves based on existing versine direction
        bounds = []
        for idx in active_indices:
            if v_ex[idx] >= 0:
                bounds.append((0, 300))
            else:
                bounds.append((-300, 0))

        x0_active = v_ex[active_indices]

        def get_corr_slew(x_active):
            raw = get_slew(x_active)
            corr = raw[-1] * np.arange(N) / (N - 1)
            return raw - corr

        def solve_for_limit(limit):
            constraints = [
                {'type': 'eq', 'fun': constr_sum},
                {'type': 'eq', 'fun': constr_moment}
            ]
            
            # Use a large default if limit is None for open constraints
            fallback = limit if limit is not None else 9999.0
            
            for i in range(N):
                l_in = limit_in[i] if i < len(limit_in) else None
                l_out = limit_out[i] if i < len(limit_out) else None
                
                c_in = abs(float(l_in)) if l_in is not None else fallback
                c_out = abs(float(l_out)) if l_out is not None else fallback
                
                constraints.append({'type': 'ineq', 'fun': (lambda idx=i, lim=c_out: lambda x_act: lim - get_corr_slew(x_act)[idx])()})
                constraints.append({'type': 'ineq', 'fun': (lambda idx=i, lim=c_in: lambda x_act: get_corr_slew(x_act)[idx] + lim)()})
                
            return minimize(objective, x0_active, method='SLSQP', bounds=bounds, constraints=constraints, options={'maxiter': 500, 'ftol': 1e-6})

        res = None
        limit_used = None
        warning = None
        
        if target_limit is not None:
            # Try user's specified limit
            res_target = solve_for_limit(target_limit)
            if res_target.success:
                res = res_target
                limit_used = target_limit
            else:
                warning = f"A strict {target_limit} mm limit was not mathematically feasible. Automatically searched for the minimum feasible limit."
                target_limit = None
                
        if target_limit is None:
            # Search for smallest feasible limit
            for limit in [10.0, 15.0, 20.0, 25.0, 30.0, 35.0, 40.0, 45.0, 50.0, 60.0, 75.0, 100.0, 150.0, 200.0, 300.0]:
                res_test = solve_for_limit(limit)
                if res_test.success:
                    res = res_test
                    limit_used = limit
                    break
                    
        if res is None or not res.success:
            print(json.dumps({"success": False, "error": "Could not find a feasible solution. Please check that data is balanced."}))
            return

        x_opt = np.zeros(N)
        x_opt[active_indices] = res.x

        # Integer refinement (coordinate descent)
        current_x = np.round(x_opt).astype(int)
        
        # Balance sum exactly
        diff_sum = int(np.sum(current_x) - np.sum(v_ex))
        if diff_sum != 0:
            step = 1 if diff_sum < 0 else -1
            for _ in range(abs(diff_sum)):
                best_idx = active_indices[np.argmax(np.abs(current_x[active_indices]))]
                current_x[best_idx] += step

        def calc_slew_profile(x):
            d = x - v_ex
            s = np.cumsum(d)
            m = np.cumsum(s)
            raw_slew = -2 * m
            corr = raw_slew[-1] * np.arange(N) / (N - 1)
            return raw_slew - corr

        def calc_smoothness(x):
            return np.sum(np.diff(x, n=2)**2)

        # Coordinate descent optimization
        def get_cd_cost(x_act):
            s = calc_slew_profile(x_act)
            viol = 0.0
            fback = limit_used if limit_used is not None else 9999.0
            for i in range(N):
                l_in = limit_in[i] if i < len(limit_in) else None
                l_out = limit_out[i] if i < len(limit_out) else None
                c_in = abs(float(l_in)) if l_in is not None else fback
                c_out = abs(float(l_out)) if l_out is not None else fback
                if s[i] < -c_in: viol += (-c_in - s[i])
                elif s[i] > c_out: viol += (s[i] - c_out)
            return np.max(np.abs(s)) + 0.005 * calc_smoothness(x_act) + 1000.0 * viol
            
        current_cost = get_cd_cost(current_x)
        improved = True
        iterations = 0
        while improved and iterations < 1000:
            improved = False
            for idx1 in active_indices:
                for idx2 in active_indices:
                    if idx1 == idx2:
                        continue
                    test_x = current_x.copy()
                    test_x[idx1] += 1
                    test_x[idx2] -= 1
                    
                    lim1 = (0, 300) if v_ex[idx1] >= 0 else (-300, 0)
                    lim2 = (0, 300) if v_ex[idx2] >= 0 else (-300, 0)
                    if not (lim1[0] <= test_x[idx1] <= lim1[1] and lim2[0] <= test_x[idx2] <= lim2[1]):
                        continue
                        
                    test_cost = get_cd_cost(test_x)
                    if test_cost < current_cost - 0.001:
                        current_x = test_x
                        current_cost = test_cost
                        improved = True
                        break
                if improved:
                    break
            iterations += 1

        final_slew = calc_slew_profile(current_x)
        final_max_slew = np.max(np.abs(final_slew))
        final_smoothness = calc_smoothness(current_x)
        
        output = {
            "success": True,
            "v_pro": current_x.tolist(),
            "slew": final_slew.tolist(),
            "max_slew": float(final_max_slew),
            "smoothness": float(final_smoothness),
            "limit_used": float(limit_used)
        }
        if warning:
            output["warning"] = warning
            
        print(json.dumps(output))
        
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == '__main__':
    main()
