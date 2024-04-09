package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/biter777/countries"
	"github.com/gmazoyer/peeringdb"
)

const PeeringDataPath = "peeringdata"
const GeoDataPath = "data"
const OutputPath = "data"

type DataSpec struct {
	Filename string
	Loader   func(api *peeringdb.API) (interface{}, error)
}

var (
	DataMap = []DataSpec{
		{
			Filename: "facilities.json",
			Loader: func(api *peeringdb.API) (interface{}, error) {
				return api.GetAllFacilities()
			},
		},
		// {
		// 	Filename: "ix-facilities.json",
		// 	Loader: func(api *peeringdb.API) (interface{}, error) {
		// 		return api.GetAllInternetExchangeFacilities()
		// 	},
		// },
		// {
		// 	Filename: "ix-lans.json",
		// 	Loader: func(api *peeringdb.API) (interface{}, error) {
		// 		return api.GetAllInternetExchangeLANs()
		// 	},
		// },
		// {
		// 	Filename: "ix-prefixes.json",
		// 	Loader: func(api *peeringdb.API) (interface{}, error) {
		// 		return api.GetAllInternetExchangePrefixes()
		// 	},
		// },
		{
			Filename: "ix.json",
			Loader: func(api *peeringdb.API) (interface{}, error) {
				return api.GetAllInternetExchanges()
			},
		},
		// {
		// 	Filename: "network-contacts.json",
		// 	Loader: func(api *peeringdb.API) (interface{}, error) {
		// 		return api.GetAllNetworkContacts()
		// 	},
		// },
		// {
		// 	Filename: "network-facilities.json",
		// 	Loader: func(api *peeringdb.API) (interface{}, error) {
		// 		return api.GetAllNetworkFacilities()
		// 	},
		// },
		{
			Filename: "network-ix-lans.json",
			Loader: func(api *peeringdb.API) (interface{}, error) {
				return api.GetAllNetworkInternetExchangeLANs()
			},
		},
		// {
		// 	Filename: "networks.json",
		// 	Loader: func(api *peeringdb.API) (interface{}, error) {
		// 		return api.GetAllNetworks()
		// 	},
		// },
		// {
		// 	Filename: "organizations.json",
		// 	Loader: func(api *peeringdb.API) (interface{}, error) {
		// 		return api.GetAllOrganizations()
		// 	},
		// },
	}
)

type GeoDatabase struct {
	cityCoords map[KeyCityCountry]Location
}

func (db *GeoDatabase) Load() error {
	file, err := os.Open(filepath.Join(GeoDataPath, "worldcities.csv"))
	if err != nil {
		log.Fatal("Error while reading the file", err)
	}
	defer file.Close()
	reader := csv.NewReader(file)

	// Ignore header
	_, _ = reader.Read()

	records, err := reader.ReadAll()
	if err != nil {
		return err
	}

	cityCoords := map[KeyCityCountry]Location{}
	addCoords := func(location Location) {
		key := KeyCityCountry{City: location.City, Country: location.Country}
		if existing, ok := cityCoords[key]; !ok || existing.Population < location.Population {
			cityCoords[key] = location
		}

		key = KeyCityCountry{City: location.City}
		if existing, ok := cityCoords[key]; !ok || existing.Population < location.Population {
			cityCoords[key] = location
		}
	}

	for _, record := range records {
		lat, err := strconv.ParseFloat(record[2], 64)
		if err != nil {
			return err
		}

		long, err := strconv.ParseFloat(record[3], 64)
		if err != nil {
			return err
		}

		population, err := strconv.ParseInt(record[9], 10, 64)
		if err != nil {
			population = 0
		}

		addCoords(Location{City: record[0], Country: record[5], Lat: lat, Long: long, Population: population})
		addCoords(Location{City: record[1], Country: record[5], Lat: lat, Long: long, Population: population})
		addCoords(Location{City: record[7], Country: record[5], Lat: lat, Long: long, Population: population})
	}

	db.cityCoords = cityCoords
	return nil
}

func (db *GeoDatabase) Lookup(city, country string) (Location, bool) {
	if newCityName, ok := manualCityMapping[city]; ok {
		city = newCityName
	}

	if coords, ok := db.cityCoords[KeyCityCountry{City: city, Country: country}]; ok {
		return coords, true
	}

	if coords, ok := db.cityCoords[KeyCityCountry{City: city}]; ok {
		return coords, true
	}

	return Location{}, false
}

type KeyCityCountry struct {
	City    string
	Country string
}

type Location struct {
	City       string  `json:"city"`
	Country    string  `json:"country"`
	Lat        float64 `json:"lat"`
	Long       float64 `json:"long"`
	Population int64   `json:"population"`
}

type CitySpeedWithCoordinates struct {
	ID         string            `json:"id"`
	City       string            `json:"city"`
	Country    string            `json:"country"`
	Region     string            `json:"region"`
	Lat        float64           `json:"lat"`
	Long       float64           `json:"long"`
	Speed      int64             `json:"speed"`
	SpeedYears map[int]SpeedYear `json:"speedYears"`
}

type SpeedYear struct {
	Year       int   `json:"year"`
	AddedSpeed int64 `json:"added_speed"`
	Total      int64 `json:"total"`
}

func main() {
	api := peeringdb.NewAPI()

	err := loadData(api)
	if err != nil {
		log.Fatalf("error loading data: %s", err)
	}

	geoDB := &GeoDatabase{}
	if err := geoDB.Load(); err != nil {
		log.Fatalf("error loading geo database")
	}

	citySpeeds, err := calculateNetworkSpeedForLocations(geoDB)
	if err != nil {
		log.Fatalf("error when calculating network speeds: %s", err)
	}

	err = exportCitySpeeds(citySpeeds, geoDB)
	if err != nil {
		log.Fatalf("error when calculating network speeds: %s", err)
	}
}

func exportCitySpeeds(citySpeeds map[Location]map[int]int64, geoDB *GeoDatabase) error {
	results := make([]CitySpeedWithCoordinates, 0, len(citySpeeds))
	for loc, speedYears := range citySpeeds {
		city := strings.TrimSpace(loc.City)
		if city == "" {
			continue
		}

		location, ok := geoDB.Lookup(city, loc.Country)
		if !ok {
			log.Printf("WARN: could not find coordinates for city: %v, %v", city, loc.Country)
			continue
		}

		sortedSpeedYears := []SpeedYear{}
		for year, speedAdded := range speedYears {
			sortedSpeedYears = append(sortedSpeedYears, SpeedYear{
				Year:       year,
				AddedSpeed: speedAdded,
				Total:      0, // calculated a little later
			})
		}
		sort.Slice(sortedSpeedYears, func(i, j int) bool {
			return sortedSpeedYears[i].Year <= sortedSpeedYears[j].Year
		})
		var total int64
		for i, speedYear := range sortedSpeedYears {
			total += speedYear.AddedSpeed
			sortedSpeedYears[i].Total += total
		}

		speedYears := map[int]SpeedYear{}
		for _, speedYear := range sortedSpeedYears {
			speedYears[speedYear.Year] = speedYear
		}

		id := fmt.Sprintf("%s-%s", loc.Country, loc.City)
		id = strings.ToLower(id)
		id = strings.ReplaceAll(id, " ", "-")
		country := countries.ByName(location.Country)
		results = append(results, CitySpeedWithCoordinates{
			ID:         id,
			City:       city,
			Country:    loc.Country,
			Region:     country.Region().String(),
			Lat:        location.Lat,
			Long:       location.Long,
			Speed:      total,
			SpeedYears: speedYears,
		})
	}

	file, err := json.MarshalIndent(results, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filepath.Join(OutputPath, "city-speeds.json"), file, 0644)
}

func calculateNetworkSpeedForLocations(geoDB *GeoDatabase) (map[Location]map[int]int64, error) {
	ixData, err := os.ReadFile(filepath.Join(PeeringDataPath, "ix.json"))
	if err != nil {
		return nil, err
	}

	ixLocations := map[int][]Location{}
	var internetExchanges []peeringdb.InternetExchange
	err = json.Unmarshal(ixData, &internetExchanges)
	if err != nil {
		return nil, err
	}

	for _, ix := range internetExchanges {
		ixLocations[ix.ID] = getLocationsForIX(geoDB, ix)
	}

	citySpeeds := map[Location]map[int]int64{}
	lanData, err := os.ReadFile(filepath.Join(PeeringDataPath, "network-ix-lans.json"))
	if err != nil {
		return nil, err
	}

	var networkIXLans []peeringdb.NetworkInternetExchangeLAN
	err = json.Unmarshal(lanData, &networkIXLans)
	if err != nil {
		return nil, err
	}

	for _, lan := range networkIXLans {
		if lan.Status != "ok" {
			continue
		}
		if lan.Speed <= 0 {
			continue
		}

		ixLocations, ok := ixLocations[lan.InternetExchangeID]
		if !ok {
			log.Printf("WARN: couldn't find record for IX: %d", lan.InternetExchangeID)
			continue
		}

		for _, location := range ixLocations {
			if location.City == "" {
				continue
			}
			speedYears, ok := citySpeeds[location]
			if !ok {
				speedYears = map[int]int64{}
				citySpeeds[location] = speedYears
			}
			speedYears[lan.Created.Year()] += int64(lan.Speed)
		}
	}

	return citySpeeds, nil
}

func getLocationsForIX(geoDB *GeoDatabase, ix peeringdb.InternetExchange) []Location {
	if ix.City == "" {
		return nil
	}

	locations := []Location{}
	cities := []string{ix.City}
	if strings.Contains(ix.City, ",") {
		cities = strings.Split(ix.City, ",")
	} else if strings.Contains(ix.City, "/") {
		cities = strings.Split(ix.City, "/")
	} else if strings.Contains(ix.City, " - ") {
		cities = strings.Split(ix.City, " - ")
	} else if strings.Contains(ix.City, " and ") {
		cities = strings.Split(ix.City, " and ")
	}

	for idx, city := range cities {
		city := strings.TrimSpace(city)
		if city == "" {
			continue
		}

		location, ok := geoDB.Lookup(city, ix.Country)
		if !ok && idx != 0 && len(city) == 2 {
			continue
		} else if !ok && idx != 0 && len(city) == 3 {
			continue
		} else if !ok {
			log.Printf("WARN: could not find coordinates; ix=%d, city='%v', full-city='%v', country='%v'", ix.ID, city, ix.City, ix.Country)
			continue
		}

		locations = append(locations, location)
	}

	return locations
}

func loadData(api *peeringdb.API) error {
	if err := os.MkdirAll(PeeringDataPath, 0700); err != nil {
		return err
	}
	for _, dataSpec := range DataMap {
		filePath := filepath.Join(PeeringDataPath, dataSpec.Filename)
		if _, err := os.Stat(filePath); err == nil {
			log.Printf("[%s]: File cached, skip download", filePath)
			continue
		}

		log.Printf("[%s]: Loading", filePath)
		data, err := dataSpec.Loader(api)
		if err != nil {
			return err
		}

		dataJSON, err := json.MarshalIndent(data, "", "  ")
		if err != nil {
			return err
		}

		err = os.WriteFile(filePath, dataJSON, 0644)
		if err != nil {
			return err
		}
		log.Printf("[%s]: Finished", filePath)
	}

	return nil
}
