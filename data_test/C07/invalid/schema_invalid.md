# Invalid Data Examples for Case 7

## Files and Expected Errors

| File | Error Type | Expected Validation Message |
| :--- | :--- | :--- |
| `work_slot_overlap.csv` | Overlapping work slots | `Overlapping work slots for doctor 'doc_1' on date '2024-10-21'` |
| `appointment_out_of_slot.csv` | Appointment outside work hours | `No work slot found for doctor 'doc_1' at 2024-10-21 18:00:00` |
| `appointment_duplicate.csv` | Duplicate appointment time | `Duplicate appointment for doctor 'doc_3' at 2024-10-23 09:00:00` |

## Validation Requirements
- Each file MUST produce the exact expected error message
- All files should be processed by `validate.py`