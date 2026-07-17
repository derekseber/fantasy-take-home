package api

import (
	"log"
	"net/http"
	"time"

	"github.com/fantasy/fantasy-take-home/task3/server/internal/ratelimit"
)

// statusWriter captures status and bytes for logging.
type statusWriter struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (w *statusWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func (w *statusWriter) Write(b []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	n, err := w.ResponseWriter.Write(b)
	w.bytes += n
	return n, err
}

// CORS wraps the next handler with permissive CORS for the Expo demo client
// and exposes Retry-After so clients can read 429 retry hints.
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Expose-Headers", "Retry-After")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Logging logs method, path, status, bytes, and duration for every response.
func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(sw, r)
		log.Printf("%s %s %d %dB %s", r.Method, r.URL.Path, sw.status, sw.bytes, time.Since(start))
	})
}

// RateLimit adapts a TokenBucket to HTTP: Allow on success, 429 + Retry-After on reject.
func RateLimit(bucket *ratelimit.TokenBucket, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		now := time.Now()
		if bucket.Allow(now) {
			next.ServeHTTP(w, r)
			return
		}
		retry := bucket.RetryAfter(now)
		secs := int(retry.Seconds())
		if secs < 1 {
			secs = 1
		}
		w.Header().Set("Retry-After", itoa(secs))
		WriteError(w, http.StatusTooManyRequests, "rate_limited", "Too many requests", map[string]any{
			"retryAfterSeconds": secs,
		})
	})
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [12]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}
