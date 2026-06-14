package pdf

import (
	"strings"
	"time"
)

// dateOnly: принимает либо time.Time, либо строку (RFC3339/ISO), возвращает YYYY-MM-DD
func dateOnly(v interface{}) string {
	switch x := v.(type) {
	case time.Time:
		return x.Format("2006-01-02")
	case *time.Time:
		if x == nil {
			return ""
		}
		return x.Format("2006-01-02")
	case string:
		s := strings.TrimSpace(x)
		if s == "" {
			return ""
		}
		// пробуем распарсить как RFC3339
		if t, err := time.Parse(time.RFC3339, s); err == nil {
			return t.Format("2006-01-02")
		}
		// быстрый fallback: отрезаем хвост после 'T'
		if i := strings.IndexByte(s, 'T'); i > 0 {
			return s[:i]
		}
		// если уже в нужном формате — вернём как есть
		if len(s) >= 10 {
			return s[:10]
		}
		return s
	default:
		return ""
	}
}
