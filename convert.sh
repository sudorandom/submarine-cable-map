#!/usr/bin/env bash

set -ex

# Make gif
# convert -delay 100 -loop 0 -dispose previous $(find output/tmp/nocountrylines/*.svg | sort) output/nocountrylines_the-internet-map.gif
# convert -delay 100 -loop 0 -dispose previous $(find output/tmp/countrylines/*.svg | sort) output/the-internet-map.gif
# rm -rf output/tmp

convert -format png output/the-internet-map.svg -crop 1200x1000+800+1600 output/the-internet-map-na.png
convert -format png output/the-internet-map.svg -crop 1200x1000+2300+1300 output/the-internet-map-eu.png
convert -format png output/the-internet-map.svg -crop 1300x1300+2380+2000 output/the-internet-map-af.png
convert -format png output/the-internet-map.svg -crop 1050x1400+1400+2400 output/the-internet-map-sa.png
convert -format png output/the-internet-map.svg -crop 1800x1600+3500+1800 output/the-internet-map-apac.png

convert -format png -resize 4096x output/the-internet-map.svg output/the-internet-map-small.png
convert -format png -resize 4096x output/nocountrylines_the-internet-map.svg output/nocountrylines_the-internet-map-small.png

convert -format webp -resize 4096x -background None output/transparent_the-internet-map.svg output/transparent_the-internet-map-small.webp
convert -format png -resize 4096x -background black output/transparent_the-internet-map.svg output/black_the-internet-map.png

mogrify -format png ./output/*.svg
mogrify -format webp ./output/*.svg
convert output/the-internet-map.svg \
	-verbose -strip -auto-orient \
	-colorspace sRGB \
	-density 300 \
	-units pixelsperinch \
	-background '#333' \
	-gravity center \
	-resize 5600x4000 \
	-extent 5600x4000 \
	-quality 100 \
	output/displate_the-internet-map.jpg

convert output/nocountrylines_the-internet-map.svg \
	-verbose -strip -auto-orient \
	-colorspace sRGB \
	-density 300 \
	-units pixelsperinch \
	-background '#333' \
	-gravity center \
	-resize 5600x4000 \
	-extent 5600x4000 \
	-quality 100 \
	output/displate_nocountrylines_the-internet-map.jpg
