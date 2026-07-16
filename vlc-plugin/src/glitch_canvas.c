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

typedef struct
{
    int profile;             /* 0 subtle, 1 medium, 2 aggressive */
    int scanline_strength;   /* 0..100 */
    int band_strength;       /* 0..100 */
    int rgb_split;           /* 0..20 */
} glitch_params_t;

struct filter_sys_t {
    bool enabled;
    bool show_controls;
    unsigned int frame_index;
    glitch_params_t p;
};

static bool GetBoolOption(const filter_t *filter, const char *name, bool default_value)
{
    for (const config_chain_t *cfg = filter->p_cfg; cfg != NULL; cfg = cfg->p_next) {
        if (cfg->psz_name == NULL || strcmp(cfg->psz_name, name) != 0)
            continue;

        if (cfg->psz_value == NULL)
            return true;

        return atoi(cfg->psz_value) != 0;
    }
    return default_value;
}

static int ClampInt(int v, int lo, int hi)
{
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
}

static int GetIntOption(const filter_t *filter, const char *name, int default_value, int lo, int hi)
{
    for (const config_chain_t *cfg = filter->p_cfg; cfg != NULL; cfg = cfg->p_next) {
        if (cfg->psz_name == NULL || strcmp(cfg->psz_name, name) != 0)
            continue;

        if (cfg->psz_value == NULL)
            return ClampInt(default_value, lo, hi);

        return ClampInt(atoi(cfg->psz_value), lo, hi);
    }
    return ClampInt(default_value, lo, hi);
}

static int ProfileFromConfig(const filter_t *filter)
{
    for (const config_chain_t *cfg = filter->p_cfg; cfg != NULL; cfg = cfg->p_next) {
        if (cfg->psz_name == NULL || strcmp(cfg->psz_name, "glitch-canvas-profile") != 0)
            continue;

        if (cfg->psz_value == NULL)
            return 1;

        if (!strcmp(cfg->psz_value, "subtle")) return 0;
        if (!strcmp(cfg->psz_value, "medium")) return 1;
        if (!strcmp(cfg->psz_value, "aggressive")) return 2;

        /* Accept numeric fallback as well */
        return ClampInt(atoi(cfg->psz_value), 0, 2);
    }
    return 1;
}

static void ApplyProfileDefaults(glitch_params_t *p)
{
    if (p->profile == 0) {
        p->scanline_strength = 20;
        p->band_strength = 25;
        p->rgb_split = 2;
    } else if (p->profile == 2) {
        p->scanline_strength = 60;
        p->band_strength = 70;
        p->rgb_split = 8;
    } else {
        p->scanline_strength = 40;
        p->band_strength = 45;
        p->rgb_split = 4;
    }
}

static void DrawControlsOverlayPacked(plane_t *plane, const glitch_params_t *p)
{
    const unsigned int height = plane->i_visible_lines < 34u ? plane->i_visible_lines : 34u;
    const unsigned int pixel_count = plane->i_visible_pitch / 4u;

    for (unsigned int y = 0; y < height; ++y) {
        uint8_t *row = plane->p_pixels + y * plane->i_pitch;
        for (unsigned int x = 0; x < pixel_count; ++x) {
            uint8_t *px = row + x * 4u;

            px[0] = (uint8_t)(px[0] * 2u / 3u);
            px[1] = (uint8_t)(px[1] * 2u / 3u);
            px[2] = (uint8_t)(px[2] * 2u / 3u);

            if (y >= 5u && y <= 28u) {
                if (x >= 8u && x <= 92u) {       /* ENABLE */
                    px[0] = 35u; px[1] = 200u; px[2] = 85u;
                } else if (x >= 100u && x <= 184u) { /* PROFILE */
                    px[0] = 75u; px[1] = 150u; px[2] = 250u;
                } else if (x >= 192u && x <= 276u) { /* SPLIT */
                    px[0] = 235u; px[1] = 130u; px[2] = 30u;
                }
            }
        }
    }

    /* Tiny profile indicator stripe */
    uint8_t marker = (uint8_t)(80 + p->profile * 70);
    for (unsigned int y = 0; y < height; ++y) {
        uint8_t *row = plane->p_pixels + y * plane->i_pitch;
        for (unsigned int x = 286u; x < 296u && x < pixel_count; ++x) {
            uint8_t *px = row + x * 4u;
            px[0] = marker;
            px[1] = marker;
            px[2] = marker;
        }
    }
}

static void DrawControlsOverlayPlanar(plane_t *plane)
{
    const unsigned int height = plane->i_visible_lines < 34u ? plane->i_visible_lines : 34u;
    const unsigned int width = plane->i_visible_pitch;

    for (unsigned int y = 0; y < height; ++y) {
        uint8_t *row = plane->p_pixels + y * plane->i_pitch;
        for (unsigned int x = 0; x < width; ++x) {
            uint8_t value = (uint8_t)(row[x] * 2u / 3u);
            if (y >= 5u && y <= 28u) {
                if ((x >= 8u && x <= 92u) ||
                    (x >= 100u && x <= 184u) ||
                    (x >= 192u && x <= 276u)) {
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

    if (!sys->enabled)
        return picture;

    plane_t *plane = &picture->p[0];
    const bool is_packed_rgba = plane->i_pixel_pitch == 4;

    const unsigned int band_period = 180u;
    const unsigned int band_size = 12u + (unsigned int)(sys->p.band_strength / 4);
    const unsigned int band_start = (sys->frame_index * 3u) % band_period;
    const unsigned int band_end = band_start + band_size;

    for (unsigned int y = 0; y < plane->i_visible_lines; ++y) {
        uint8_t *pixels = plane->p_pixels + y * plane->i_pitch;
        const bool is_scanline = ((y + sys->frame_index / 3u) % 4u) == 0u;
        const bool is_data_band = (y % band_period) >= band_start && (y % band_period) < band_end;

        if (is_packed_rgba) {
            for (unsigned int x = 0; x + 3u < plane->i_visible_pitch; x += 4u) {
                uint8_t r = pixels[x];
                uint8_t g = pixels[x + 1u];
                uint8_t b = pixels[x + 2u];

                if (is_scanline) {
                    int k = 100 - sys->p.scanline_strength / 2;
                    r = (uint8_t)(r * k / 100);
                    g = (uint8_t)(g * k / 100);
                    b = (uint8_t)(b * k / 100);
                }

                if (is_data_band) {
                    /* Band color permutation strength */
                    int t = sys->p.band_strength;
                    uint8_t nr = (uint8_t)((b * t + r * (100 - t)) / 100);
                    uint8_t ng = (uint8_t)((r * t + g * (100 - t)) / 100);
                    uint8_t nb = (uint8_t)((g * t + b * (100 - t)) / 100);
                    r = nr; g = ng; b = nb;
                }

                pixels[x]     = r;
                pixels[x + 1] = g;
                pixels[x + 2] = b;
            }

            /* Horizontal RGB split: shift channels in-place by tiny offsets */
            int split = sys->p.rgb_split;
            if (split > 0) {
                for (unsigned int x = (unsigned int)(split * 4); x + 3u < plane->i_visible_pitch; x += 4u) {
                    pixels[x] = pixels[x - (unsigned int)(split * 4)]; /* red from left */
                }
                for (unsigned int x = 0; x + 3u + (unsigned int)(split * 4) < plane->i_visible_pitch; x += 4u) {
                    pixels[x + 2u] = pixels[x + 2u + (unsigned int)(split * 4)]; /* blue from right */
                }
            }

        } else {
            for (unsigned int x = 0; x < plane->i_visible_pitch; ++x) {
                uint8_t v = pixels[x];

                if (is_scanline) {
                    int k = 100 - sys->p.scanline_strength / 2;
                    v = (uint8_t)(v * k / 100);
                }

                if (is_data_band) {
                    int t = sys->p.band_strength;
                    uint8_t inv = (uint8_t)(255u - v);
                    v = (uint8_t)((inv * t + v * (100 - t)) / 100);
                }

                pixels[x] = v;
            }
        }
    }

    if (sys->show_controls) {
        if (is_packed_rgba)
            DrawControlsOverlayPacked(plane, &sys->p);
        else
            DrawControlsOverlayPlanar(plane);
    }

    sys->frame_index++;
    return picture;
}

static int Open(vlc_object_t *object)
{
    filter_t *filter = (filter_t *)object;

    filter_sys_t *sys = calloc(1, sizeof(*sys));
    if (sys == NULL)
        return VLC_ENOMEM;

    sys->enabled = GetBoolOption(filter, "glitch-canvas-enable", true);
    sys->show_controls = GetBoolOption(filter, "glitch-canvas-show-controls", true);

    sys->p.profile = ProfileFromConfig(filter);
    ApplyProfileDefaults(&sys->p);

    /* If explicit values are set, they override profile defaults */
    sys->p.scanline_strength = GetIntOption(filter, "glitch-canvas-scanline-strength", sys->p.scanline_strength, 0, 100);
    sys->p.band_strength = GetIntOption(filter, "glitch-canvas-band-strength", sys->p.band_strength, 0, 100);
    sys->p.rgb_split = GetIntOption(filter, "glitch-canvas-rgb-split", sys->p.rgb_split, 0, 20);

    filter->p_sys = sys;
    filter->pf_video_filter = FilterVideo;
    return VLC_SUCCESS;
}

static void Close(vlc_object_t *object)
{
    filter_t *filter = (filter_t *)object;
    free(filter->p_sys);
}

static const char *const profile_values[] = {
    "subtle", "medium", "aggressive"
};
static const char *const profile_texts[] = {
    "Subtle", "Medium", "Aggressive"
};

vlc_module_begin()
    set_shortname("Glitch Canvas")
    set_description("Animated glitch-video effect")
    set_subcategory(SUBCAT_VIDEO_VFILTER)

    add_bool("glitch-canvas-enable", true,
             "Enable Glitch Canvas effect",
             "When disabled, the module stays loaded but leaves frames unchanged.", false)

    add_string("glitch-canvas-profile", "medium",
               "Glitch profile",
               "Preset profile controlling baseline effect intensities.", false)
    change_string_list(profile_values, profile_texts)

    add_integer_with_range("glitch-canvas-scanline-strength", 40, 0, 100,
                           "Scanline strength",
                           "Intensity of scanline darkening.", false)

    add_integer_with_range("glitch-canvas-band-strength", 45, 0, 100,
                           "Data band strength",
                           "Intensity of moving data-band permutation/inversion.", false)

    add_integer_with_range("glitch-canvas-rgb-split", 4, 0, 20,
                           "RGB split amount",
                           "Horizontal red/blue channel separation amount.", false)

    add_bool("glitch-canvas-show-controls", true,
             "Show on-video control strip",
             "Draws a simple control strip overlay at the top of the video.", false)

    set_capability("video filter", 0)
    set_callbacks(Open, Close)
    add_shortcut("glitch_canvas")
vlc_module_end()