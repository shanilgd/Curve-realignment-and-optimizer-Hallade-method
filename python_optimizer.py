import sys
import json
import numpy as np
from scipy.optimize import minimize, LinearConstraint

def main():
    try:
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        
        v_ex = np.array(data.get('v_ex', []), dtype=float)
        target_limit = data.get('slew_limit', None)
        limit_in = data.get('max_slew_in', [])
        limit_out = data.get('max_slew_out', [])
        locked_versines = data.get('locked_versines', [])
        
        N = len(v_ex)
        
        non_zero_indices = np.where(np.abs(v_ex) > 0)[0]
        if len(non_zero_indices) == 0:
            v_pro = np.zeros(N, dtype=int)
            print(json.dumps({"success": True, "v_pro": v_pro.tolist(), "slew": [0.0]*N, "max_slew": 0.0, "smoothness": 0.0, "limit_used": 0.0, "warning": "All existing versines were zero."}))
            return
            
        first_active = max(0, non_zero_indices[0] - 3)
        last_active = min(N - 1, non_zero_indices[-1] + 3)
        
        active_mask = np.zeros(N, dtype=bool)
        active_mask[first_active:last_active+1] = True
        active_indices = np.where(active_mask)[0]
        n_active = len(active_indices)
        
        # Build Objective Matrix P
        # f(x) = (D x)^T (D x)
        D = np.zeros((N-2, N))
        for i in range(N-2):
            D[i, i] = 1.0
            D[i, i+1] = -2.0
            D[i, i+2] = 1.0
        
        # Z maps x_active to x
        Z = np.zeros((N, n_active))
        for j, idx in enumerate(active_indices):
            Z[idx, j] = 1.0
            
        DZ = D @ Z
        P_active = 2.0 * (DZ.T @ DZ)
        
        def objective(x_active):
            return 0.5 * (x_active.T @ P_active @ x_active)
            
        def jacobian(x_active):
            return P_active @ x_active

        # Build Slew Matrix
        L = np.tril(np.ones((N, N)))
        L_shift = np.tril(np.ones((N, N)), -1)
        M_slew = -2.0 * L_shift @ L
        
        # A_slew maps x_active to slew
        A_slew = M_slew @ Z
        
        # Build Equality Constraints
        A_eq1 = np.ones(n_active)
        b_eq1 = np.sum(v_ex)
        
        weights = np.arange(N, 0, -1)
        A_eq2 = weights[active_indices]
        b_eq2 = np.sum(weights * v_ex)
        
        A_eq_list = [A_eq1, A_eq2]
        b_eq_list = [b_eq1, b_eq2]
        
        if locked_versines:
            for global_idx in range(min(N, len(locked_versines))):
                if locked_versines[global_idx] is not None:
                    # Find local index in active_indices
                    local_idx_arr = np.where(active_indices == global_idx)[0]
                    if len(local_idx_arr) > 0:
                        local_idx = local_idx_arr[0]
                        new_row = np.zeros(n_active)
                        new_row[local_idx] = 1.0
                        A_eq_list.append(new_row)
                        b_eq_list.append(float(locked_versines[global_idx]))

        A_eq = np.vstack(A_eq_list)
        b_eq = np.array(b_eq_list)
        
        eq_constraint = LinearConstraint(A_eq, b_eq, b_eq)
        
        # Build bounds
        bounds = []
        for idx in active_indices:
            if v_ex[idx] >= 0:
                bounds.append((0, 300))
            else:
                bounds.append((-300, 0))
                
        x0_active = v_ex[active_indices]
        
        def solve_for_limit(limit):
            fback = limit if limit is not None else 9999.0
            
            l_in_arr = np.array([abs(float(limit_in[i])) if i < len(limit_in) and limit_in[i] is not None else fback for i in range(N)])
            l_out_arr = np.array([abs(float(limit_out[i])) if i < len(limit_out) and limit_out[i] is not None else fback for i in range(N)])
            
            # lb <= A_slew @ x_active + M_slew @ (-v_ex) <= ub
            # lb - M_slew @ (-v_ex) <= A_slew @ x_active <= ub - M_slew @ (-v_ex)
            # base = M_slew @ (-v_ex) = - M_slew @ v_ex
            base = - (M_slew @ v_ex)
            
            lb_slew = -l_in_arr - base
            ub_slew = l_out_arr - base
            
            slew_constraint = LinearConstraint(A_slew, lb_slew, ub_slew)
            
            return minimize(objective, x0_active, method='SLSQP', jac=jacobian, bounds=bounds, constraints=[eq_constraint, slew_constraint], options={'maxiter': 500, 'ftol': 1e-6})

        res = None
        limit_used = None
        warning = None
        
        if target_limit is not None:
            res_target = solve_for_limit(target_limit)
            if res_target.success:
                res = res_target
                limit_used = target_limit
            else:
                warning = f"A strict {target_limit} mm limit was not mathematically feasible. Automatically searched for the minimum feasible limit."
                target_limit = None
                
        if target_limit is None:
            for limit in [10.0, 15.0, 20.0, 25.0, 30.0, 35.0, 40.0, 45.0, 50.0, 60.0, 75.0, 100.0, 150.0, 200.0, 300.0, None]:
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

        # Simple integer rounding that preserves smoothness
        current_x = np.round(x_opt).astype(int)
        
        diff_sum = int(np.sum(current_x) - np.sum(v_ex))
        
        if diff_sum != 0:
            step = -1 if diff_sum > 0 else 1
            error = x_opt - current_x
            
            if locked_versines:
                for global_idx in range(min(N, len(locked_versines))):
                    if locked_versines[global_idx] is not None:
                        if step == 1:
                            error[global_idx] = -np.inf
                        else:
                            error[global_idx] = np.inf
                            
            for _ in range(abs(diff_sum)):
                if step == 1:
                    best_idx_active = np.argmax(error[active_indices])
                else:
                    best_idx_active = np.argmin(error[active_indices])
                    
                actual_idx = active_indices[best_idx_active]
                current_x[actual_idx] += step
                error[actual_idx] -= step

        def calc_slew_profile(x):
            d = x - v_ex
            s = np.cumsum(d)
            m = np.cumsum(np.insert(s[:-1], 0, 0))
            raw_slew = -2 * m
            corr = raw_slew[-1] * np.arange(N) / (N - 1)
            return raw_slew - corr

        def calc_smoothness(x):
            return np.sum(np.diff(x, n=2)**2)
            
        final_slew = calc_slew_profile(current_x)
        final_max_slew = np.max(np.abs(final_slew))
        
        final_smoothness = calc_smoothness(current_x)
        if len(current_x) >= 3:
            final_smoothness = final_smoothness / (len(current_x) - 2)
        else:
            final_smoothness = 0.0
        
        output = {
            "success": True,
            "v_pro": current_x.tolist(),
            "slew": final_slew.tolist(),
            "max_slew": float(final_max_slew),
            "smoothness": float(final_smoothness),
            "limit_used": float(limit_used) if limit_used is not None else None
        }
        if warning:
            output["warning"] = warning
            
        print(json.dumps(output))
        
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == '__main__':
    main()
