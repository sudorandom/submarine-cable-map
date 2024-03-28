#!/usr/bin/env bash

set -ex

# Make gif
convert -delay 100 -loop 0 -dispose previous $(find output/tmp/parts/*.svg | sort) output/geo-mercator.gif
rm -rf output/tmp

# Make mp4s
./node_modules/timecut/cli.js \
	--screenshot-type=png \
	--fps 1 \
	--frames=40 \
	--start-delay=1 \
	-V 5600,4000 \
	--output=output/geo-mercator.mp4 \
	output/animated_geo-mercator.svg

./node_modules/timecut/cli.js \
	--screenshot-type=png \
	--fps 1 \
	--frames=40 \
	--start-delay=1 \
	-V 5600,4000 \
	--output=output/nocountrylines_geo-mercator.mp4 \
	output/animated_nocountrylines_geo-mercator.svg

convert -format png output/geo-mercator.svg -crop 1200x1000+800+1600 output/geo-mercator-na.png
convert -format png output/geo-mercator.svg -crop 1200x1000+2300+1300 output/geo-mercator-eu.png
convert -format png output/geo-mercator.svg -crop 1300x1300+2380+2000 output/geo-mercator-af.png
convert -format png output/geo-mercator.svg -crop 1050x1400+1400+2400 output/geo-mercator-sa.png
convert -format png output/geo-mercator.svg -crop 1800x1600+3500+1800 output/geo-mercator-apac.png

convert -format png -resize 4096x output/geo-mercator.svg output/geo-mercator-small.png
convert -format png -resize 4096x output/nocountrylines_geo-mercator.svg output/nocountrylines_geo-mercator-small.png

convert -format webp -resize 4096x -background None output/transparent_geo-mercator.svg output/transparent_geo-mercator-small.webp
convert -format png -resize 4096x -background black output/transparent_geo-mercator.svg output/black_geo-mercator.png

mogrify -format png ./output/*.svg
mogrify -format webp ./output/*.svg
convert output/geo-mercator.svg \
	-verbose -strip -auto-orient \
	-colorspace sRGB \
	-density 300 \
	-units pixelsperinch \
	-background '#333' \
	-gravity center \
	-resize 5600x4000 \
	-extent 5600x4000 \
	-quality 100 \
	output/displate_geo-mercator.jpg

convert output/nocountrylines_geo-mercator.svg \
	-verbose -strip -auto-orient \
	-colorspace sRGB \
	-density 300 \
	-units pixelsperinch \
	-background '#333' \
	-gravity center \
	-resize 5600x4000 \
	-extent 5600x4000 \
	-quality 100 \
	output/displate_nocountrylines_geo-mercator.jpg
