```sh

#Qualidade razoavel - arquivo menor

ffmpeg -i \
afiliados.mp4 \
-vf "scale='min(1080,iw)':-2" \
-c:v libx264 \
-profile:v baseline \
-level 3.1 \
-preset medium \
-crf 28 \
-r 30   \
-c:a aac \
-b:a 128k \
-movflags +faststart \
output_afiliados.mp4

#Qualidade melhor - arquivo maior

ffmpeg -i \
vsl_original.mp4 \
-vf "scale='min(1080,iw)':-2" \
-c:v libx264 \
-profile:v baseline \
-level 3.1 \
-preset slow \
-crf 23 \
-r 30   \
-c:a aac \
-b:a 128k \
-movflags +faststart \
vsl_medium_quality.mp4


for f in *.ogg; do ffmpeg -i "$f" -c:a libmp3lame -q:a 2 "${f%.ogg}.mp3"; done

```