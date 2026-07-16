#ifdef HAVE_CONFIG_H
# include "config.h"
#endif

#include <stdint.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

#ifdef _WIN32
# include <BaseTsd.h>
typedef SSIZE_T ssize_t;
#endif

#include <vlc_common.h>
#include <vlc_filter.h>
#include <vlc_picture.h>
#include <vlc_plugin.h>
#include <vlc_configuration.h>

struct filter_sys_t {
    bool enabled;
    bool show_controls;
    unsigned int frame_index;
};

static bool GetBoolOption(const filter_t *filter, const char *name, bool default_value)
{
    for (const config_chain_t *cfg = filter->p_cfg; cfg != NULL; cfg = cfg->p_next) {
        if (cfg->psz_name == NULL || strcmp(cfg->psz_name, name) != 0) {
            continue;
        }

        if (cfg->psz_value == NULL) {
            return true;
        }

        return atoi(cfg->psz_value) != 0;
    }

    return default_value;
}

static void DrawControlsOverlayPacked(plane_t *plane)
{
    const unsigned int height = plane->i_visible_lines < 28u ? plane->i_visible_lines : 28u;
    const unsigned int pixel_count = plane->i_visible_pitch / 4u;

    for (unsigned int y = 0; y < height; ++y) {
        uint8_t *row = plane->p_pixels + y * plane->i_pitch;
        for (unsigned int p = 0; p < pixel_count; ++p) {
            uint8_t *px = row + p * 4u;

            px[0] = (uint8_t)(px[0] * 2u / 3u);
            px[1] = (uint8_t)(px[1] * 2u / 3u);
            px[2] = (uint8_t)(px[2] * 2u / 3u);

            if (y >= 4u && y <= 23u) {
                if (p >= 8u && p <= 74u) {
                    px[0] = 30u;
                    px[1] = 200u;
                    px[2] = 80u;
                } else if (p >= 84u && p <= 150u) {
                    px[0] = 70u;
                    px[1] = 140u;
                    px[2] = 245u;
                } else if (p >= 160u && p <= 226u) {
                    px[0] = 235u;
                    px[1] = 120u;
                    px[2] = 30u;
                }
            }
        }
    }
}

static void DrawControlsOverlayPlanar(plane_t *plane)
{
    const unsigned int height = plane->i_visible_lines < 28u ? plane->i_visible_lines : 28u;
    const unsigned int width = plane->i_visible_pitch;

    for (unsigned int y = 0; y < height; ++y) {
        uint8_t *row = plane->p_pixels + y * plane->i_pitch;
        for (unsigned int x = 0; x < width; ++x) {
            uint8_t value = (uint8_t)(row[x] * 2u / 3u);
            if (y >= 4u && y <= 23u) {
                if ((x >= 8u && x <= 74u) ||
                    (x >= 84u && x <= 150u) ||
                    (x >= 160u && x <= 226u)) {
                    value = 220u;
                }
            }
            row[x] = value;
        }
    }
}

static picture_t *FilterVideo(filter_t *filter, picture_t *picture)
{
    filter_sys_t *sys = filter->p_sys;

    if (!sys->enabled) {
        return picture;
    }

    plane_t *plane = &picture->p[0];
    const bool is_packed_rgba = plane->i_pixel_pitch == 4;
    const unsigned int band_start = (sys->frame_index * 3u) % 180u;
    const unsigned int band_end = band_start + 18u;

    for (unsigned int y = 0; y < plane->i_visible_lines; ++y) {
        uint8_t *pixels = plane->p_pixels + y * plane->i_pitch;
        const bool is_scanline = (y + sys->frame_index / 3u) % 4u == 0u;
        const bool is_data_band = y % 180u >= band_start && y % 180u < band_end;

        if (is_packed_rgba) {
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
        } else {
            for (unsigned int x = 0; x < plane->i_visible_pitch; ++x) {
                uint8_t value = pixels[x];

                if (is_scanline) {
                    value = (uint8_t)(value * 3u / 4u);
                }

                if (is_data_band) {
                    value = (uint8_t)(255u - value);
                }

                pixels[x] = value;
            }
        }
    }

    if (sys->show_controls) {
        if (is_packed_rgba) {
            DrawControlsOverlayPacked(plane);
        } else {
            DrawControlsOverlayPlanar(plane);
        }
    }

    sys->frame_index++;
    return picture;
}

static int Open(vlc_object_t *object)
{
    filter_t *filter = (filter_t *)object;

    filter_sys_t *sys = calloc(1, sizeof(*sys));
    if (sys == NULL) {
        return VLC_ENOMEM;
    }

    sys->enabled = GetBoolOption(filter, "glitch-canvas-enable", true);
    sys->show_controls = GetBoolOption(filter, "glitch-canvas-show-controls", true);
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
    add_bool("glitch-canvas-show-controls", true,
             "Show on-video control strip",
             "Draws a simple control strip overlay at the top of the video.", false)
    set_capability("video filter", 0)
    set_callbacks(Open, Close)
    add_shortcut("glitch_canvas")
vlc_module_end()