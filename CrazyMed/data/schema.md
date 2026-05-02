# Схема данных T1 для Кейса 7

**case**: 07_DoctorSchedule  
**dataset_version**: 1.0  
**seed**: 42  

---

## speciality.csv

| Поле | Тип | Обязательное |
|------|-----|--------------|
| id | string | да |
| speciality | string | да |

## user.csv

| Поле | Тип | Обязательное | Уникальное |
|------|-----|--------------|------------|
| id | string | да | да |
| fio | string | да | нет |
| email | string | да | да |
| password | string | да | нет |
| role | string | да | нет |

**role**: doctor, patient, admin

## work_slot.csv

| Поле | Тип | Обязательное |
|------|-----|--------------|
| id | string | да |
| date | YYYY-MM-DD | да |
| start_time | HH:MM | да |
| end_time | HH:MM | да |
| slots_minutes | integer | да |
| break_start | HH:MM | нет |
| break_end | HH:MM | нет |

**Правила**: start_time < end_time, перерыв внутри рабочего дня


## appointment.csv

| Поле | Тип | Обязательное |
|------|-----|--------------|
| appt_id | integer | да |
| doctor_id | string | да |
| patient_code | string | да |
| slot_datetime | YYYY-MM-DD HH:MM | да |
| status | string | да |

**status**: booked, cancelled, completed

## canceled_appointment.csv

| Поле | Тип | Обязательное |
|------|-----|--------------|
| appt_id | integer | да |
| why_cancelled | string | да |

## Размер T1

| Файл | Строк |
|------|-------|
| speciality.csv | 5 |
| user.csv | 26 |
| work_slot.csv | 40 |
| appointment.csv | 200 |
| canceled_appointment.csv | 40 |

