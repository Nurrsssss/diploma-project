package models

type PatientRecommendationsRequest struct {
	AppointmentID     string `json:"appointment_id" binding:"required"`
	DoctorID          string `json:"doctor_id" binding:"required"`
	Lang              string `json:"lang" binding:"required"`
	TranscriptionText string `json:"transcription_text" binding:"required"`
}

type PatientRecommendationsResponse struct {
	FileID      string `json:"file_id"`
	DownloadURL string `json:"download_url"`
}
