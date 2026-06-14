package audio

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

func SplitAudioToChunks(filePath string, chunkDurationSec int, outputDir string) ([]string, error) {
	if outputDir == "" {
		outputDir = "/tmp"
	}

	baseFileName := filepath.Base(filePath)
	nameWithoutExt := strings.TrimSuffix(baseFileName, filepath.Ext(baseFileName))
	outputPattern := filepath.Join(outputDir, fmt.Sprintf("%s_chunk_%%03d.mp3", nameWithoutExt))

	cmd := exec.Command("ffmpeg",
		"-i", filePath,
		"-f", "segment",
		"-segment_time", fmt.Sprintf("%d", chunkDurationSec),
		"-c:a", "copy",
		"-avoid_negative_ts", "make_zero",
		"-break_non_keyframes", "1",
		outputPattern,
	)

	cmd.Stdout = nil
	cmd.Stderr = nil

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("ffmpeg split error: %v", err)
	}

	pattern := filepath.Join(outputDir, fmt.Sprintf("%s_chunk_*.mp3", nameWithoutExt))
	matches, err := filepath.Glob(pattern)
	if err != nil {
		return nil, fmt.Errorf("error finding chunk files: %v", err)
	}

	if len(matches) == 0 {
		return nil, fmt.Errorf("no chunks created")
	}

	sort.Slice(matches, func(i, j int) bool {
		return extractChunkNumber(matches[i]) < extractChunkNumber(matches[j])
	})

	return matches, nil
}

func extractChunkNumber(filename string) int {
	base := filepath.Base(filename)
	parts := strings.Split(base, "_")
	if len(parts) < 2 {
		return 0
	}

	chunkPart := parts[len(parts)-1]
	numStr := strings.TrimSuffix(chunkPart, ".mp3")
	num, err := strconv.Atoi(numStr)
	if err != nil {
		return 0
	}
	return num
}

func GetAudioDuration(filePath string) (float64, error) {
	cmd := exec.Command("ffprobe",
		"-v", "error",
		"-show_entries", "format=duration",
		"-of", "csv=p=0",
		filePath,
	)

	output, err := cmd.Output()
	if err != nil {
		return 0, fmt.Errorf("ffprobe error: %v", err)
	}

	durationStr := strings.TrimSpace(string(output))
	duration, err := strconv.ParseFloat(durationStr, 64)
	if err != nil {
		return 0, fmt.Errorf("failed to parse duration: %v", err)
	}

	return duration, nil
}

func OptimizeAudioForWhisper(inputPath, outputPath string) error {
	cmd := exec.Command("ffmpeg",
		"-i", inputPath,
		"-ar", "16000",
		"-ac", "1",
		"-c:a", "pcm_s16le",
		"-y",
		outputPath,
	)

	cmd.Stdout = nil
	cmd.Stderr = nil

	return cmd.Run()
}

func CleanupTempFiles(pattern string) error {
	matches, err := filepath.Glob(pattern)
	if err != nil {
		return err
	}

	for _, file := range matches {
		if err := os.Remove(file); err != nil {

		}
	}

	return nil
}
