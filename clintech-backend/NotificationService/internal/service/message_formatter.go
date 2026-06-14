package service

import (
	"fmt"
	"strings"

	"NotificationService/internal/domain/models"
)

// MessageFormatter форматирует сообщения для разных каналов
type MessageFormatter struct{}

func NewMessageFormatter() *MessageFormatter {
	return &MessageFormatter{}
}

// FormatForTelegram форматирует сообщение для Telegram с Markdown
func (f *MessageFormatter) FormatForTelegram(notification *models.Notification) (string, bool) {
	switch notification.Type {
	case models.UserRegistered:
		return f.formatUserRegistered(notification), true
	case models.UserProfileUpdated:
		return f.formatUserProfileUpdated(notification), true
	case models.AppointmentBooked:
		return f.formatAppointmentBooked(notification), true
	case models.AppointmentCanceled:
		return f.formatAppointmentCanceled(notification), true
	default:
		// Для неизвестных типов возвращаем обычное сообщение
		return notification.Message, false
	}
}

// FormatForWhatsApp форматирует сообщение для WhatsApp
func (f *MessageFormatter) FormatForWhatsApp(notification *models.Notification) (string, bool) {
	switch notification.Type {
	case models.UserRegistered:
		return f.formatWhatsAppUserRegistered(notification), true
	case models.UserProfileUpdated:
		return f.formatWhatsAppUserProfileUpdated(notification), true
	case models.AppointmentBooked:
		return f.formatWhatsAppAppointmentBooked(notification), true
	case models.AppointmentCanceled:
		return f.formatWhatsAppAppointmentCanceled(notification), true
	case models.AppointmentReminder:
		return f.formatWhatsAppAppointmentReminder(notification), true
	default:
		// Для неизвестных типов возвращаем обычное сообщение
		return notification.Message, false
	}
}

// FormatForSMS форматирует сообщение для SMS
func (f *MessageFormatter) FormatForSMS(notificationType string, data map[string]interface{}) string {
	switch notificationType {
	case "user_registered":
		return f.formatSMSUserRegistered(data)
	case "user_profile_updated":
		return f.formatSMSUserProfileUpdated(data)
	case "appointment_booked":
		return f.formatSMSAppointmentBooked(data)
	case "appointment_new":
		return f.formatSMSAppointmentNew(data)
	case "appointment_canceled":
		return f.formatSMSAppointmentCanceled(data)
	case "appointment_reminder":
		return f.formatSMSAppointmentReminder(data)
	default:
		return f.formatGenericSMS(data)
	}
}

func (f *MessageFormatter) formatUserRegistered(notification *models.Notification) string {
	userMeta, err := notification.GetUserMetadata()
	if err != nil || userMeta == nil {
		return f.escapeMarkdown("НОВЫЙ ПОЛЬЗОВАТЕЛЬ ЗАРЕГИСТРИРОВАН")
	}

	var sb strings.Builder
	sb.WriteString("*НОВЫЙ ПОЛЬЗОВАТЕЛЬ ЗАРЕГИСТРИРОВАН*\n")
	sb.WriteString("────────────────────────────────────\n\n")

	// Основная информация
	if userMeta.FullName != "" && userMeta.FullName != userMeta.Email {
		sb.WriteString(fmt.Sprintf("• *Имя:* %s\n", f.escapeMarkdown(userMeta.FullName)))
	}

	if userMeta.Email != "" {
		sb.WriteString(fmt.Sprintf("• *Email:* `%s`\n", f.escapeMarkdown(userMeta.Email)))
	}

	if userMeta.Username != "" && userMeta.Username != userMeta.Email {
		sb.WriteString(fmt.Sprintf("• *Логин:* %s\n", f.escapeMarkdown(userMeta.Username)))
	}

	if userMeta.Role != "" {
		roleName := f.getRoleDisplayName(userMeta.Role)
		sb.WriteString(fmt.Sprintf("• *Роль:* %s\n", f.escapeMarkdown(roleName)))
	}

	// Системная информация
	sb.WriteString("\n*СИСТЕМНАЯ ИНФОРМАЦИЯ:*\n")
	sb.WriteString(fmt.Sprintf("• *ID пользователя:* `%s`\n", f.escapeMarkdown(userMeta.UserID.String())))
	sb.WriteString(fmt.Sprintf("• *Время регистрации:* %s", f.escapeMarkdown(notification.CreatedAt.Format("02.01.2006 15:04:05"))))

	return sb.String()
}

// WhatsApp форматирование для регистрации пользователя
func (f *MessageFormatter) formatWhatsAppUserRegistered(notification *models.Notification) string {
	userMeta, err := notification.GetUserMetadata()
	if err != nil || userMeta == nil {
		return "НОВЫЙ ПОЛЬЗОВАТЕЛЬ ЗАРЕГИСТРИРОВАН"
	}

	var sb strings.Builder
	sb.WriteString("*НОВЫЙ ПОЛЬЗОВАТЕЛЬ ЗАРЕГИСТРИРОВАН*\n\n")

	// Основная информация
	if userMeta.FullName != "" && userMeta.FullName != userMeta.Email {
		sb.WriteString(fmt.Sprintf("Имя: %s\n", userMeta.FullName))
	}

	if userMeta.Email != "" {
		sb.WriteString(fmt.Sprintf("Email: %s\n", userMeta.Email))
	}

	if userMeta.Role != "" {
		roleName := f.getRoleDisplayName(userMeta.Role)
		sb.WriteString(fmt.Sprintf("Роль: %s\n", roleName))
	}

	sb.WriteString(fmt.Sprintf("\nВремя: %s", notification.CreatedAt.Format("02.01.2006 15:04")))

	return sb.String()
}

func (f *MessageFormatter) formatUserProfileUpdated(notification *models.Notification) string {
	userMeta, err := notification.GetUserMetadata()
	if err != nil || userMeta == nil {
		return f.escapeMarkdown("ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ ОБНОВЛЕН")
	}

	var sb strings.Builder
	sb.WriteString("*ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ ОБНОВЛЕН*\n")
	sb.WriteString("────────────────────────────────────\n\n")

	if userMeta.FullName != "" {
		sb.WriteString(fmt.Sprintf("• *Пользователь:* %s\n", f.escapeMarkdown(userMeta.FullName)))
	}

	if userMeta.Email != "" {
		sb.WriteString(fmt.Sprintf("• *Email:* `%s`\n", f.escapeMarkdown(userMeta.Email)))
	}

	sb.WriteString(fmt.Sprintf("\n• *Время обновления:* %s", f.escapeMarkdown(notification.CreatedAt.Format("02.01.2006 15:04:05"))))

	return sb.String()
}

// WhatsApp форматирование для обновления профиля
func (f *MessageFormatter) formatWhatsAppUserProfileUpdated(notification *models.Notification) string {
	userMeta, err := notification.GetUserMetadata()
	if err != nil || userMeta == nil {
		return "ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ ОБНОВЛЕН"
	}

	var sb strings.Builder
	sb.WriteString("*ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ ОБНОВЛЕН*\n\n")

	if userMeta.FullName != "" {
		sb.WriteString(fmt.Sprintf("Пользователь: %s\n", userMeta.FullName))
	}

	if userMeta.Email != "" {
		sb.WriteString(fmt.Sprintf("Email: %s\n", userMeta.Email))
	}

	sb.WriteString(fmt.Sprintf("\nВремя: %s", notification.CreatedAt.Format("02.01.2006 15:04")))

	return sb.String()
}

func (f *MessageFormatter) formatAppointmentBooked(notification *models.Notification) string {
	appointmentMeta, err := notification.GetAppointmentMetadata()
	if err != nil || appointmentMeta == nil {
		return f.escapeMarkdown("НОВАЯ ЗАПИСЬ К ВРАЧУ")
	}

	var sb strings.Builder
	sb.WriteString("*НОВАЯ ЗАПИСЬ К ВРАЧУ*\n")
	sb.WriteString("────────────────────────────────────\n\n")

	sb.WriteString(fmt.Sprintf("• *Пациент:* %s\n", f.escapeMarkdown(appointmentMeta.PatientName)))
	sb.WriteString(fmt.Sprintf("• *Врач:* %s\n", f.escapeMarkdown(appointmentMeta.DoctorName)))

	if appointmentMeta.Specialty != "" {
		sb.WriteString(fmt.Sprintf("• *Специализация:* %s\n", f.escapeMarkdown(appointmentMeta.Specialty)))
	}

	sb.WriteString(fmt.Sprintf("• *Дата и время:* %s\n", f.escapeMarkdown(appointmentMeta.DateTime.Format("02.01.2006 15:04"))))
	sb.WriteString(fmt.Sprintf("• *Длительность:* %d минут\n", appointmentMeta.Duration))

	sb.WriteString(fmt.Sprintf("\n• *ID записи:* `%s`", f.escapeMarkdown(appointmentMeta.AppointmentID.String())))

	return sb.String()
}

// WhatsApp форматирование для записи к врачу
func (f *MessageFormatter) formatWhatsAppAppointmentBooked(notification *models.Notification) string {
	appointmentMeta, err := notification.GetAppointmentMetadata()
	if err != nil || appointmentMeta == nil {
		return "НОВАЯ ЗАПИСЬ К ВРАЧУ"
	}

	var sb strings.Builder
	sb.WriteString("*НОВАЯ ЗАПИСЬ К ВРАЧУ*\n\n")

	sb.WriteString(fmt.Sprintf("Пациент: %s\n", appointmentMeta.PatientName))
	sb.WriteString(fmt.Sprintf("Врач: %s\n", appointmentMeta.DoctorName))

	if appointmentMeta.Specialty != "" {
		sb.WriteString(fmt.Sprintf("Специализация: %s\n", appointmentMeta.Specialty))
	}

	sb.WriteString(fmt.Sprintf("Дата: %s\n", appointmentMeta.DateTime.Format("02.01.2006")))
	sb.WriteString(fmt.Sprintf("Время: %s\n", appointmentMeta.DateTime.Format("15:04")))
	sb.WriteString(fmt.Sprintf("Длительность: %d мин", appointmentMeta.Duration))

	return sb.String()
}

func (f *MessageFormatter) formatAppointmentCanceled(notification *models.Notification) string {
	appointmentMeta, err := notification.GetAppointmentMetadata()
	if err != nil || appointmentMeta == nil {
		return f.escapeMarkdown("ЗАПИСЬ К ВРАЧУ ОТМЕНЕНА")
	}

	var sb strings.Builder
	sb.WriteString("*ЗАПИСЬ К ВРАЧУ ОТМЕНЕНА*\n")
	sb.WriteString("────────────────────────────────────\n\n")

	sb.WriteString(fmt.Sprintf("• *Пациент:* %s\n", f.escapeMarkdown(appointmentMeta.PatientName)))
	sb.WriteString(fmt.Sprintf("• *Врач:* %s\n", f.escapeMarkdown(appointmentMeta.DoctorName)))

	if appointmentMeta.Specialty != "" {
		sb.WriteString(fmt.Sprintf("• *Специализация:* %s\n", f.escapeMarkdown(appointmentMeta.Specialty)))
	}

	sb.WriteString(fmt.Sprintf("• *Дата и время:* %s\n", f.escapeMarkdown(appointmentMeta.DateTime.Format("02.01.2006 15:04"))))

	sb.WriteString(fmt.Sprintf("\n• *ID записи:* `%s`", f.escapeMarkdown(appointmentMeta.AppointmentID.String())))

	return sb.String()
}

// WhatsApp форматирование для отмены записи
func (f *MessageFormatter) formatWhatsAppAppointmentCanceled(notification *models.Notification) string {
	appointmentMeta, err := notification.GetAppointmentMetadata()
	if err != nil || appointmentMeta == nil {
		return "ЗАПИСЬ К ВРАЧУ ОТМЕНЕНА"
	}

	var sb strings.Builder
	sb.WriteString("*ЗАПИСЬ К ВРАЧУ ОТМЕНЕНА*\n\n")

	sb.WriteString(fmt.Sprintf("Пациент: %s\n", appointmentMeta.PatientName))
	sb.WriteString(fmt.Sprintf("Врач: %s\n", appointmentMeta.DoctorName))

	if appointmentMeta.Specialty != "" {
		sb.WriteString(fmt.Sprintf("Специализация: %s\n", appointmentMeta.Specialty))
	}

	sb.WriteString(fmt.Sprintf("Дата: %s\n", appointmentMeta.DateTime.Format("02.01.2006")))
	sb.WriteString(fmt.Sprintf("Время: %s", appointmentMeta.DateTime.Format("15:04")))

	return sb.String()
}

// WhatsApp форматирование для напоминания о записи
func (f *MessageFormatter) formatWhatsAppAppointmentReminder(notification *models.Notification) string {
	appointmentMeta, err := notification.GetAppointmentMetadata()
	if err != nil || appointmentMeta == nil {
		return "НАПОМИНАНИЕ О ЗАПИСИ К ВРАЧУ"
	}

	var sb strings.Builder
	sb.WriteString("*НАПОМИНАНИЕ О ЗАПИСИ*\n\n")

	sb.WriteString(fmt.Sprintf("Пациент: %s\n", appointmentMeta.PatientName))
	sb.WriteString(fmt.Sprintf("Врач: %s\n", appointmentMeta.DoctorName))

	if appointmentMeta.Specialty != "" {
		sb.WriteString(fmt.Sprintf("Специализация: %s\n", appointmentMeta.Specialty))
	}

	sb.WriteString(fmt.Sprintf("Дата: %s\n", appointmentMeta.DateTime.Format("02.01.2006")))
	sb.WriteString(fmt.Sprintf("Время: %s\n", appointmentMeta.DateTime.Format("15:04")))
	sb.WriteString(fmt.Sprintf("Длительность: %d мин\n", appointmentMeta.Duration))

	sb.WriteString("\nНе забудьте о записи!")

	return sb.String()
}

// formatSMSUserRegistered форматирует сообщение о регистрации для SMS
func (f *MessageFormatter) formatSMSUserRegistered(data map[string]interface{}) string {
	// Проверяем роль пользователя
	role, ok := data["role"].(string)
	if !ok {
		role = "patient" // По умолчанию считаем пациентом
	}

	// Разные сообщения для разных ролей
	switch role {
	case "doctor":
		return "Добро пожаловать в Clintech! Ваш аккаунт врача успешно создан. Начните принимать пациентов и вести приемы."
	case "admin":
		return "Добро пожаловать в Clintech! Ваш административный аккаунт успешно создан."
	default:
		// Для пациентов и других ролей
		return "Добро пожаловать в Clintech! Пройдите анкету на сайте и получите консультацию врача и советы от ИИ."
	}
}

// formatSMSUserProfileUpdated форматирует сообщение об обновлении профиля для SMS
func (f *MessageFormatter) formatSMSUserProfileUpdated(data map[string]interface{}) string {
	return "Clintech: Ваш профиль успешно обновлен. Изменения сохранены в системе."
}

// formatSMSAppointmentBooked форматирует сообщение о записи на прием для SMS
func (f *MessageFormatter) formatSMSAppointmentBooked(data map[string]interface{}) string {
	return "Clintech: Запись подтверждена!"
}

// formatSMSAppointmentNew форматирует сообщение о новой записи для SMS
func (f *MessageFormatter) formatSMSAppointmentNew(data map[string]interface{}) string {
	return "Clintech: Новая запись!"
}

// formatSMSAppointmentCanceled форматирует сообщение об отмене приема для SMS
func (f *MessageFormatter) formatSMSAppointmentCanceled(data map[string]interface{}) string {
	return "Clintech: Прием отменен."
}

// formatSMSAppointmentReminder форматирует напоминание о приеме для SMS
func (f *MessageFormatter) formatSMSAppointmentReminder(data map[string]interface{}) string {
	return "Clintech: Напоминание о приеме!"
}

// formatGenericSMS форматирует общее сообщение для SMS
func (f *MessageFormatter) formatGenericSMS(data map[string]interface{}) string {
	message, ok := data["message"].(string)
	if !ok {
		return "Clintech: У вас есть новое уведомление. Войдите в систему для подробностей."
	}

	// Отправляем сообщение как есть, без обрезки
	return message
}

func (f *MessageFormatter) getRoleEmoji(role string) string {
	switch role {
	case "admin":
		return "Admin"
	case "doctor":
		return "Doctor"
	case "patient":
		return "Patient"
	default:
		return "User"
	}
}

func (f *MessageFormatter) getRoleDisplayName(role string) string {
	switch role {
	case "admin":
		return "Администратор"
	case "doctor":
		return "Врач"
	case "patient":
		return "Пациент"
	default:
		return role
	}
}

func (f *MessageFormatter) escapeMarkdown(text string) string {
	// Экранируем специальные символы для Markdown
	text = strings.ReplaceAll(text, "_", "\\_")
	text = strings.ReplaceAll(text, "*", "\\*")
	text = strings.ReplaceAll(text, "`", "\\`")
	text = strings.ReplaceAll(text, "[", "\\[")
	text = strings.ReplaceAll(text, "]", "\\]")
	text = strings.ReplaceAll(text, "(", "\\(")
	text = strings.ReplaceAll(text, ")", "\\)")
	text = strings.ReplaceAll(text, "~", "\\~")
	text = strings.ReplaceAll(text, ">", "\\>")
	text = strings.ReplaceAll(text, "#", "\\#")
	text = strings.ReplaceAll(text, "+", "\\+")
	text = strings.ReplaceAll(text, "-", "\\-")
	text = strings.ReplaceAll(text, "=", "\\=")
	text = strings.ReplaceAll(text, "|", "\\|")
	text = strings.ReplaceAll(text, "{", "\\{")
	text = strings.ReplaceAll(text, "}", "\\}")
	text = strings.ReplaceAll(text, ".", "\\.")
	text = strings.ReplaceAll(text, "!", "\\!")
	return text
}
