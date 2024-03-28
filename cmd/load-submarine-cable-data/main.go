package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"

	geojson "github.com/paulmach/go.geojson"
)

const DirPath = "data/submarinecables"

func main() {

	cableContent, err := loadAndWriteJSON("https://www.submarinecablemap.com/api/v3/cable/cable-geo.json")
	if err != nil {
		log.Fatalf("error: %s", err)
	}

	cableColl, err := geojson.UnmarshalFeatureCollection(cableContent)
	if err != nil {
		log.Fatalf("error: %s", err)
	}

	for _, feature := range cableColl.Features {
		cableURL := fmt.Sprintf("https://www.submarinecablemap.com/api/v3/cable/%s.json", feature.Properties["id"])
		if _, err := loadAndWriteJSON(cableURL); err != nil {
			log.Fatalf("error: %s", err)
		}
	}

	landingPointContent, err := loadAndWriteJSON("https://www.submarinecablemap.com/api/v3/landing-point/landing-point-geo.json")
	if err != nil {
		log.Fatalf("error: %s", err)
	}

	landingPointColl, err := geojson.UnmarshalFeatureCollection(landingPointContent)
	if err != nil {
		log.Fatalf("error: %s", err)
	}

	for _, feature := range landingPointColl.Features {
		cableURL := fmt.Sprintf("https://www.submarinecablemap.com/api/v3/landing-point/%s.json", feature.Properties["id"])
		if _, err := loadAndWriteJSON(cableURL); err != nil {
			log.Fatalf("error: %s", err)
		}
	}
}

func loadAndWriteJSON(url string) ([]byte, error) {

	fileName := filepath.Base(url)
	dirName := filepath.Base(filepath.Dir(url))
	dirPath := filepath.Join(DirPath, dirName)
	filePath := filepath.Join(dirPath, fileName)
	if err := os.MkdirAll(dirPath, os.ModePerm); err != nil {
		return nil, err
	}

	if _, err := os.Stat(filePath); err == nil {
		log.Printf("Not downloading %s since it's cached", filePath)
		return os.ReadFile(filePath)
	}

	log.Printf("Downloading %s since it's not cached from %s", filePath, url)
	resp, err := http.Get(url)
	if err != nil {
		log.Fatalf("error: %s", err)
	}

	content, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Fatalf("error: %s", err)
	}

	return content, os.WriteFile(filePath, content, 0644)
}
