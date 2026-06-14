package models

import (
	"time"
)

type HealthPassport struct {
	ID                string              `json:"id"`
	PatientID         string              `json:"patient_id"`
	DoctorID          string              `json:"doctor_id"`
	AppointmentID     string              `json:"appointment_id"`
	AnalysisID        string              `json:"analysis_id"`
	TranscriptionText *string             `json:"transcription_text,omitempty"`
	Content           *HealthPassportData `json:"content,omitempty"`
	CreatedAt         time.Time           `json:"created_at"`
	UpdatedAt         time.Time           `json:"updated_at"`
	FileID            *string             `json:"file_id,omitempty"`
}

type HealthPassportData struct {
	Patient *PatientInfo `json:"patient"`
	Doctor  *DoctorInfo  `json:"doctor"`

	Answers map[string]string `json:"answers,omitempty"`

	Complaints        string `json:"complaints"`
	MedicalHistory    string `json:"medical_history"`
	Lifestyle         string `json:"lifestyle"`
	FilesAnalysis     string `json:"files_analysis"`
	GeneralConclusion string `json:"general_conclusion"`

	// НОВОЕ (под ваш HTML)
	CurrentState       string   `json:"current_state,omitempty"`
	ObjectiveStatus    string   `json:"objective_status,omitempty"`
	DiagnosisMain      string   `json:"diagnosis_main,omitempty"`
	DiagnosisComorbid  []string `json:"diagnosis_comorbid,omitempty"`
	PlanExam           string   `json:"plan_exam,omitempty"`
	PlanTreatment      string   `json:"plan_treatment,omitempty"`
	PlanGeneral        string   `json:"plan_general,omitempty"`

	GeneratedAt string `json:"generated_at"`
}


type PatientInfo struct {
    ID              string   `json:"id"`
    FirstName       string   `json:"first_name"`
    MiddleName      string   `json:"middle_name"`
    LastName        string   `json:"last_name"`
    BirthDate       string   `json:"birth_date"`
    Age             int      `json:"age"`
    Gender          string   `json:"gender"`
    IIN             string   `json:"iin"`
    Phone           string   `json:"phone"`
    Email           string   `json:"email"`
    Address         string   `json:"address"`
    Height          float64  `json:"height"`
    Weight          float64  `json:"weight"`
    BMI             float64  `json:"bmi"`

    // Новое: витальные показатели (опционально)
    Temperature     *float64 `json:"temperature,omitempty"`   // °C
    SystolicBP      *int     `json:"systolic_bp,omitempty"`   // мм рт. ст.
    DiastolicBP     *int     `json:"diastolic_bp,omitempty"`  // мм рт. ст.
    Pulse           *int     `json:"pulse,omitempty"`         // уд/мин
    Saturation      *int     `json:"saturation,omitempty"`   // % (SpO2)
    BPString        *string  `json:"bp,omitempty"`            // исходная строка, если было "120/80"

    ChronicDiseases []string `json:"chronic_diseases"`
    Allergies       []string `json:"allergies"`
    Diets           []string `json:"diets"`
}

type DoctorInfo struct {
	ID          string   `json:"id"`
	FirstName   string   `json:"first_name"`
	MiddleName  string   `json:"middle_name"`
	LastName    string   `json:"last_name"`
	Roles       []string `json:"roles"`
	Email       string   `json:"email"`
	Phone       string   `json:"phone"`
	Description string   `json:"description"`
}

type HealthPassportRequest struct {
	AppointmentID     string            `json:"appointment_id" binding:"required"`
	AnalysisID        string            `json:"analysis_id"` // Опционально: может быть пустым для генерации без анкеты
	DoctorID          string            `json:"doctor_id" binding:"required"`
	Lang              string            `json:"lang" binding:"required"`
	Answers           map[string]string `json:"answers,omitempty"`
	TranscriptionText *string           `json:"transcription_text,omitempty"`
}

type HealthPassportContentUpdateRequest struct {
	// БАЗОВЫЕ ТЕКСТОВЫЕ ПОЛЯ
	Complaints        *string `json:"complaints,omitempty"`
	MedicalHistory    *string `json:"medical_history,omitempty"`
	Lifestyle         *string `json:"lifestyle,omitempty"`
	FilesAnalysis     *string `json:"files_analysis,omitempty"`
	GeneralConclusion *string `json:"general_conclusion,omitempty"`

	// СТАРЫЕ ПОЛЯ (оставлены для обратной совместимости; сервис их не пишет в HealthPassportData)
	ChronicDiseases *string `json:"chronic_diseases,omitempty"`
	FamilyHistory   *string `json:"family_history,omitempty"`
	Medications     *string `json:"medications,omitempty"`
	DietsAllergies  *string `json:"diets_allergies,omitempty"`
	Diagnoses       *string `json:"diagnoses,omitempty"`
	ObservationPlan *string `json:"observation_plan,omitempty"`

	// НОВЫЕ СТРУКТУРИРОВАННЫЕ ПОЛЯ (для вашего HTML-шаблона)
	ObjectiveStatus   *string   `json:"objective_status,omitempty"`
	DiagnosisMain     *string   `json:"diagnosis_main,omitempty"`
	DiagnosisComorbid *[]string `json:"diagnosis_comorbid,omitempty"`
	PlanExam          *string   `json:"plan_exam,omitempty"`
	PlanTreatment     *string   `json:"plan_treatment,omitempty"`
	PlanGeneral       *string   `json:"plan_general,omitempty"`

	Lang *string `json:"lang,omitempty"`
}


type HealthPassportRegenerateRequest struct {
	Lang string `json:"lang,omitempty"`
}
