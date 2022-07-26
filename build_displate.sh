#!/usr/bin/env bash

set -ex

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
