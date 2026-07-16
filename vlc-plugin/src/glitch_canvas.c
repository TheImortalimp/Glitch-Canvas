#ifdef HAVE_CONFIG_H
# include "config.h"
#endif

#include <stdint.h>
#include <stdbool.h>
#include <stdlib.h>

#ifdef _WIN32
# include <BaseTsd.h>
typedef SSIZE_T ssize_t;
#endif

#include <vlc_common.h>
#include <vlc_filter.h>
#include <vlc_picture.h>
#include <vlc_plugin.h>
#include <vlc_variables.h>

struct filter_sys_t {
    bool enabled;
    unsigned int frame_index;
};

static picture_t *FilterVideo(filter_t *filter, picture_t *picture)
{
    filter_sys_t *sys = filter->p_sys;

    if (!sys->enabled) {
        return picture;
    }

    plane_t *plane = &picture->p[0];
    const unsigned int band_start = (sys->frame_index * 3u) % 180u;
    const unsigned int band_end = band_start + 18u;

    for (unsigned int y = 0; y < plane->i_visible_lines; ++y) {
        uint8_t *pixels = plane->p_pixels + y * plane->i_pitch;
        const bool is_scanline = (y + sys->frame_index / 3u) % 4u == 0u;
        const bool is_data_band = y % 180u >= band_start && y % 180u < band_end;

        for (unsigned int x = 0; x + 3u < plane->i_visible_pitch; x += 4u) {
            uint8_t red = pixels[x];
            uint8_t green = pixels[x + 1u];
            uint8_t blue = pixels[x + 2u];

            if (is_scanline) {
                red = (uint8_t)(red * 3u / 4u);
                green = (uint8_t)(green * 3u / 4u);
                blue = (uint8_t)(blue * 3u / 4u);
            }

            if (is_data_band) {
                pixels[x] = blue;
                pixels[x + 1u] = red;
                pixels[x + 2u] = green;
            } else {
                pixels[x] = red;
                pixels[x + 1u] = green;
                pixels[x + 2u] = blue;
            }
        }
    }

    sys->frame_index++;
    return picture;
}

static int Open(vlc_object_t *object)
{
    filter_t *filter = (filter_t *)object;

    if (filter->fmt_in.video.i_chroma != VLC_CODEC_RGBA) {
        return VLC_EGENERIC;
    }

    filter_sys_t *sys = calloc(1, sizeof(*sys));
    if (sys == NULL) {
        return VLC_ENOMEM;
    }

    sys->enabled = var_CreateGetBool(filter, "glitch-canvas-enable");
    filter->p_sys = sys;
    filter->pf_video_filter = FilterVideo;
    return VLC_SUCCESS;
}

static void Close(vlc_object_t *object)
{
    filter_t *filter = (filter_t *)object;
    free(filter->p_sys);
}

vlc_module_begin()
    set_shortname("Glitch Canvas")
    set_description("Animated glitch-video effect")
    set_subcategory(SUBCAT_VIDEO_VFILTER)
    add_bool("glitch-canvas-enable", true,
             "Enable Glitch Canvas effect",
             "When disabled, the module stays loaded but leaves frames unchanged.", false)
    set_capability("video filter", 0)
    set_callbacks(Open, Close)
    add_shortcut("glitch_canvas")
vlc_module_end()