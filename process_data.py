import json
import glob
import numpy as np

EARTH_DIAMETER = 12742


def all_cables_json():
	with open('data/www.submarinecablemap.com/web/public/api/v3/cable/all.json') as f:
		return json.load(f)


def load_all_cables():
	cables = all_cables_json()
	for cable_ref in cables:
		with open(f"data/www.submarinecablemap.com/web/public/api/v3/cable/{cable_ref['id']}.json") as f:
			cable = json.load(f)
			if cable['length'] is not None:
				length, unit = cable['length'].split(' ', 2)
				if unit != "km":
					print(unit)

				cable['length_km'] = int(length.replace(',', ''))

			yield cable


def cable_stats(cables):
	length = sum((cable.get('length_km') or 0 for cable in cables))
	return {
		'count': len(cables),
		'length': length,
		'wrap_earth_count': wrap_earth_count(length),
	}


def all_cable_stats(cables):
	return {
		'active': cable_stats([cable for cable in cables if not cable["is_planned"]]),
		'planned': cable_stats([cable for cable in cables if cable["is_planned"]]),
	}


def wrap_earth_count(km):
	return km / EARTH_DIAMETER


def main():
	cables = list(load_all_cables())
	stats = all_cable_stats(cables)
	
	print('*** Active Cables ***')
	print(f"Count: {stats['active']['count']}")
	print(f"Length: {stats['active']['length']} km (enough to wrap the earth {stats['active']['wrap_earth_count']:.0f} times)")
	print()

	print('*** Planned Cables ***')
	print(f"Count: {stats['planned']['count']}")
	print(f"Length: {stats['planned']['length']} km")

	with open('data/stats.json', 'w', encoding='utf-8') as f:
		json.dump(stats, f)



if __name__ == '__main__':
	main()