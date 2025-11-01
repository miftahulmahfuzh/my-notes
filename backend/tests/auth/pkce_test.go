package auth

import (
	"crypto/sha256"
	"encoding/base64"
	"strings"
	"testing"

	"github.com/gpd/my-notes/internal/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPKCECodeVerifierGeneration(t *testing.T) {
	// Test multiple generations to ensure randomness
	for i := 0; i < 100; i++ {
		verifier, err := auth.GenerateCodeVerifier()
		require.NoError(t, err)

		// Verify length requirements (43-128 characters)
		assert.True(t, len(verifier) >= 43, "Code verifier should be at least 43 characters")
		assert.True(t, len(verifier) <= 128, "Code verifier should not exceed 128 characters")

		// Verify character set (only unreserved URI characters)
		assert.Regexp(t, `^[A-Za-z0-9-._~]+$`, verifier, "Code verifier should only contain unreserved characters")
	}
}

func TestPKCECodeChallengeGeneration(t *testing.T) {
	testCases := []struct {
		name     string
		verifier string
	}{
		{
			name:     "short verifier",
			verifier: "short",
		},
		{
			name:     "typical verifier",
			verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
		},
		{
			name:     "long verifier",
			verifier: strings.Repeat("a", 128),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			challenge := auth.GenerateCodeChallenge(tc.verifier)

			// Verify the challenge is a valid base64url encoding
			assert.Regexp(t, `^[A-Za-z0-9-_]+$`, challenge)

			// Verify the challenge is the correct SHA256 hash
			hash := sha256.Sum256([]byte(tc.verifier))
			expectedChallenge := base64.RawURLEncoding.EncodeToString(hash[:])
			assert.Equal(t, expectedChallenge, challenge)
		})
	}
}

func TestPKCEChallengeConsistency(t *testing.T) {
	verifier := "test-verifier-12345"

	challenge1 := auth.GenerateCodeChallenge(verifier)
	challenge2 := auth.GenerateCodeChallenge(verifier)

	// Same verifier should always produce same challenge
	assert.Equal(t, challenge1, challenge2)
}

func TestPKCEChallengeLength(t *testing.T) {
	verifier := strings.Repeat("a", 64) // 64 characters
	challenge := auth.GenerateCodeChallenge(verifier)

	// SHA256 base64url encoding without padding should always be 43 characters
	assert.Equal(t, 43, len(challenge))
}


func TestPKCEWithKnownValues(t *testing.T) {
	// Test with known values from RFC 7636 examples
	verifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	expectedChallenge := "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

	challenge := auth.GenerateCodeChallenge(verifier)
	assert.Equal(t, expectedChallenge, challenge)
}

func TestPKCEUniqueness(t *testing.T) {
	const numIterations = 1000
	challenges := make(map[string]bool)

	// Generate many challenges and verify they're all unique
	for i := 0; i < numIterations; i++ {
		verifier, err := auth.GenerateCodeVerifier()
		require.NoError(t, err)

		challenge := auth.GenerateCodeChallenge(verifier)

		// The challenge should be unique
		assert.False(t, challenges[challenge], "Challenge should be unique")
		challenges[challenge] = true
	}

	// We should have generated exactly numIterations unique challenges
	assert.Equal(t, numIterations, len(challenges))
}