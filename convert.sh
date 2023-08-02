#!/usr/bin/env bash

set -ex

convert -format png output/geo-mercator.svg -crop 1200x1000+800+1600 output/geo-mercator-na.png
convert -format png output/geo-mercator.svg -crop 1200x1000+2300+1300 output/geo-mercator-eu.png
convert -format png output/geo-mercator.svg -crop 1300x1300+2380+2000 output/geo-mercator-af.png
convert -format png output/geo-mercator.svg -crop 1050x1400+1400+2400 output/geo-mercator-sa.png
convert -format png output/geo-mercator.svg -crop 1800x1600+3500+1800 output/geo-mercator-apac.png

mogrify -format png ./output/*.svg
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
