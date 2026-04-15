# Schema for Case 7: Doctor's Appointment Schedule

**Case ID:** C07
**Dataset Version:** 1.0
**Seed:** 42

## Tables

### 1. speciality
| Column     | Type   | Required | Description                 | Domain / Example               |
| :--------- | :----- | :------- | :-------------------------- | :----------------------------- |
| `id`       | string | Yes      | Unique specialty identifier | `"therapist"`, `"surgeon"`     |
| `specialty`| string | Yes      | Specialty name              | `"Терапевт"`, `"Хирург"`       |

### 2. user
| Column     | Type   | Required | Description                | Domain / Example                           |
| :--------- | :----- | :------- | :------------------------- | :----------------------------------------- |
| `id`       | string | Yes      | Unique user identifier (FK) | `"doc_1"`, `"pat_101"`                   |
| `fio`      | string | Yes      | Full name                  | `"Иванова Анна Петровна"`                 |
| `email`    | string | Yes      | Email address              | `"doctor1@clinic.com"`                     |
| `password` | string | Yes      | Password hash (mock)       | `"hashed_password_1"`                      |
| `role`     | string | Yes      | User role                  | `doctor`, `patient`, `admin`               |

**Foreign Key:** None

### 3. work_slot
| Column          | Type    | Required | Description                    | Domain / Example                         |
| :-------------- | :------ | :------- | :----------------------------- | :--------------------------------------- |
| `id`            | string  | Yes      | Unique slot identifier         | `"slot_1"`                               |
| `date`          | date    | Yes      | Date of the workday            | `2024-10-21`                             |
| `start_time`    | time    | Yes      | Start of working hours          | `09:00:00`                               |
| `end_time`      | time    | Yes      | End of working hours            | `17:00:00`                               |
| `slot_minutes`  | integer | Yes      | Duration of one appointment slot | `15`, `20`, `30`                         |
| `break_start`   | time    | No       | Start of a break                | `13:00:00`                               |
| `break_end`     | time    | No       | End of a break                  | `14:00:00`                               |
| `doctor_id`     | string  | Yes      | Assigned doctor (FK to `user.id`) | `doc_1`                                  |

**Foreign Key:** `doctor_id` references `user.id` where `user.role = 'doctor'`.

### 4. appointment
| Column           | Type     | Required | Description                     | Domain / Example                         |
| :--------------- | :------- | :------- | :------------------------------ | :--------------------------------------- |
| `appt_id`        | string   | Yes      | Unique appointment identifier   | `"appt_1"`                               |
| `doctor_id`      | string   | Yes      | Doctor's ID (FK to `user.id`)   | `doc_1`                                  |
| `patient_code`   | string   | Yes      | Patient's ID (FK to `user.id`)  | `pat_101`                                |
| `slot_datetime`  | datetime | Yes      | Date and time of the appointment| `2024-10-21T09:00:00`                    |
| `status`         | string   | Yes      | Current status of the slot      | `booked`, `canceled_by_doctor`, `canceled_by_patient`, `served` |

**Foreign Keys:** `doctor_id` references `user.id`; `patient_code` references `user.id`.

### 5. canceled_appointment
| Column         | Type   | Required | Description                     | Domain / Example                         |
| :------------- | :----- | :------- | :------------------------------ | :--------------------------------------- |
| `appt_id`      | string | Yes      | Appt. ID (FK to `appointment.appt_id`) | `appt_1`                            |
| `why_canceled` | string | No       | Reason for cancellation/transfer | `"Пациент не пришел"`, `"Ошибка в записи"` |

**Foreign Key:** `appt_id` references `appointment.appt_id`.

## Business Rules & Validations

1.  **work_slot:**
    *   `start_time < end_time`
    *   `break_start < break_end` (if both are provided)
    *   `break_start` and `break_end` must be within the `[start_time, end_time]` interval.
    *   No overlapping slots for the same `doctor_id` on the same `date`.
2.  **appointment:**
    *   `slot_datetime` must fall within a valid `work_slot` interval (respecting breaks) for the specified `doctor_id`.
    *   A `doctor_id` cannot have two appointments with the same `slot_datetime`.
    *   `status` must be one of the predefined values.
3.  **canceled_appointment:**
    *   An entry exists only if `appointment.status` is `canceled_by_doctor` or `canceled_by_patient`.
    *   `why_canceled` is required if the appointment is canceled.

## Data Volumes for T1 (Minimum)

*   `speciality`: 3-5 rows
*   `user`: 15-25 rows (3-5 doctors, 12-20 patients)
*   `work_slot`: 20-40 rows (one week of schedule for 3-5 doctors)
*   `appointment`: 60-100 rows
*   `canceled_appointment`: 10-20 rows