package middleware

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// RequestID adds a unique request ID to each request
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := r.Header.Get("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}

		ctx := context.WithValue(r.Context(), "requestID", requestID)
		w.Header().Set("X-Request-ID", requestID)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// Logging logs all incoming requests
func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if logging is disabled
		logRequests := true
		if value := os.Getenv("LOG_REQUESTS"); value != "" {
			if boolValue, err := strconv.ParseBool(value); err == nil {
				logRequests = boolValue
			}
		}

		start := time.Now()

		// Create a response writer wrapper to capture status code
		wrapped := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		next.ServeHTTP(wrapped, r)

		// Only log if logging is enabled
		if logRequests {
			duration := time.Since(start)
			requestID, _ := r.Context().Value("requestID").(string)

			log.Printf(
				"[%s] %s %s %d %v %s",
				requestID,
				r.Method,
				r.URL.Path,
				wrapped.statusCode,
				duration,
				r.RemoteAddr,
			)
		}
	})
}

// Recovery recovers from panics and logs them
func Recovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				requestID, _ := r.Context().Value("requestID").(string)
				log.Printf("[%s] Panic recovered: %v", requestID, err)

				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			}
		}()

		next.ServeHTTP(w, r)
	})
}

// CORS handles Cross-Origin Resource Sharing
func CORS(allowedOrigins, allowedMethods, allowedHeaders []string, maxAge int) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			// Set headers for preflight requests
			if r.Method == http.MethodOptions {
				w.Header().Set("Access-Control-Allow-Origin", getAllowedOrigin(origin, allowedOrigins))
				w.Header().Set("Access-Control-Allow-Methods", strings.Join(allowedMethods, ","))
				w.Header().Set("Access-Control-Allow-Headers", strings.Join(allowedHeaders, ","))
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Max-Age", fmt.Sprintf("%d", maxAge))
				w.WriteHeader(http.StatusOK)
				return
			}

			// Set headers for actual requests
			w.Header().Set("Access-Control-Allow-Origin", getAllowedOrigin(origin, allowedOrigins))
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Expose-Headers", "X-Request-ID")

			next.ServeHTTP(w, r)
		})
	}
}

// ContentType ensures JSON content type for API responses
func ContentType(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Only apply to API routes
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
		}
		next.ServeHTTP(w, r)
	})
}

// Timeout adds a timeout to requests
func Timeout(timeout time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, cancel := context.WithTimeout(r.Context(), timeout)
			defer cancel()

			r = r.WithContext(ctx)

			done := make(chan struct{})
			go func() {
				defer close(done)
				next.ServeHTTP(w, r)
			}()

			select {
			case <-done:
				// Request completed normally
			case <-ctx.Done():
				// Request timed out
				requestID, _ := r.Context().Value("requestID").(string)
				log.Printf("[%s] Request timeout", requestID)

				w.WriteHeader(http.StatusRequestTimeout)
				w.Write([]byte(`{"error":"Request timeout"}`))
			}
		})
	}
}

// SecurityHeaders adds security-related headers
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

		next.ServeHTTP(w, r)
	})
}

// RateLimit applies basic rate limiting
func RateLimit(requests int, window time.Duration) func(http.Handler) http.Handler {
	type client struct {
		requests int
		window   time.Time
	}

	clients := make(map[string]*client)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			clientIP := r.RemoteAddr
			now := time.Now()

			if c, exists := clients[clientIP]; exists {
				// Reset window if expired
				if now.Sub(c.window) > window {
					c.requests = 0
					c.window = now
				}

				// Check rate limit
				if c.requests >= requests {
					requestID, _ := r.Context().Value("requestID").(string)
					log.Printf("[%s] Rate limit exceeded for %s", requestID, clientIP)

					w.WriteHeader(http.StatusTooManyRequests)
					w.Write([]byte(`{"error":"Rate limit exceeded"}`))
					return
				}

				c.requests++
			} else {
				clients[clientIP] = &client{
					requests: 1,
					window:   now,
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}

// responseWriter is a wrapper around http.ResponseWriter that captures the status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// getAllowedOrigin returns the appropriate origin for CORS
func getAllowedOrigin(requestOrigin string, allowedOrigins []string) string {
	// Check for exact match first
	for _, origin := range allowedOrigins {
		if origin == requestOrigin {
			return origin
		}
	}

	// Check for wildcard patterns (chrome-extension://*)
	for _, origin := range allowedOrigins {
		if strings.HasSuffix(origin, "://*") {
			prefix := strings.TrimSuffix(origin, "*")
			if strings.HasPrefix(requestOrigin, prefix) {
				return requestOrigin
			}
		}
	}

	// If wildcard is allowed, return the request origin
	for _, origin := range allowedOrigins {
		if origin == "*" {
			return requestOrigin
		}
	}

	// If no match found, return the first allowed origin or empty string
	if len(allowedOrigins) > 0 {
		return allowedOrigins[0]
	}
	return ""
}