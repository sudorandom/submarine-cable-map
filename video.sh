#!/usr/bin/env bash

# https://sengpielaudio.com/calculator-bpmtempotime.htm
# 110bpm/60s = 1.8333 / 2
# 545ms*2 = 1090ms sleep time
FPS="0.916666666666667"
# video duration, set to something high to allow for the stopCapture callback to control the duration
# Set to something low for testing
# DURATION="15"
DURATION="240"

set -ex

# Make mp4s
./node_modules/timecut/cli.js \
	./output/animated/geo-mercator.svg \
	--duration="${DURATION}" \
	--stop-function-name=stopCapture \
	--fps "${FPS}" \
	-V 5600,4000 \
	--output=output/animated/geo-mercator_quiet.mp4

video_length=$(ffprobe -i ./output/animated/geo-mercator_quiet.mp4 -show_entries format=duration -v quiet -of csv="p=0")
video_length_int=$(printf "%.0f\n" "$video_length")
video_fade_offset=$(($video_length_int - 5))

echo "video_length=${video_length}; video_fade_offset=${video_fade_offset}"

ffmpeg -y -i output/animated/geo-mercator_quiet.mp4 \
	-i "assets/Vacuum_Of_Space_-_Jaxius.mp3" \
	-c:v copy \
	-c:a aac \
	-shortest \
	-af "afade=t=out:st=${video_fade_offset}:d=5" \
	output/animated/geo-mercator.mp4

# ./node_modules/timecut/cli.js \
# 	--duration="${DURATION}" \
# 	--stop-function-name=stopCapture \
# 	--fps "${FPS}" \
# 	-V 5600,4000 \
# 	--output=output/animated/nocountrylines_geo-mercator_quiet.mp4 \
# 	output/animated/nocountrylines_geo-mercator.svg

# video_length=$(ffprobe -i ./output/animated/nocountrylines_geo-mercator_quiet.mp4 -show_entries format=duration -v quiet -of csv="p=0")
# video_length_int=$(printf "%.0f\n" "$video_length")
# video_fade_offset=$(($video_length_int - 5))

# echo "video_length=${video_length}; video_fade_offset=${video_fade_offset}"

# ffmpeg -y -i output/animated/nocountrylines_geo-mercator_quiet.mp4 \
# 	-i "assets/Vacuum_Of_Space_-_Jaxius.mp3" \
# 	-c:v copy \
# 	-c:a aac \
# 	-shortest \
# 	-af "afade=t=out:st=${video_fade_offset}:d=5" \
# 	output/animated/nocountrylines_geo-mercator.mp4
