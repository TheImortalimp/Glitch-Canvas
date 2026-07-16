cmake_minimum_required(VERSION 3.21)

project(glitch_canvas_vlc_filter LANGUAGES C)

set(VLC_PLUGIN_INCLUDE_DIR "" CACHE PATH "Directory containing VLC internal headers")

if(NOT EXISTS "${VLC_PLUGIN_INCLUDE_DIR}/vlc_common.h")
  message(FATAL_ERROR
    "Set VLC_PLUGIN_INCLUDE_DIR to the include directory of a matching VLC source tree.")
endif()

add_library(glitch_canvas MODULE src/glitch_canvas.c)

# Produce a self-contained Windows plugin that does not require VCRUNTIME140.dll
# to be preinstalled on target machines.
if(MSVC)
  set_property(TARGET glitch_canvas PROPERTY
    MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
endif()

target_compile_features(glitch_canvas PRIVATE c_std_11)
target_compile_definitions(glitch_canvas PRIVATE
  __PLUGIN__
  MODULE_STRING="glitch_canvas")
target_include_directories(glitch_canvas PRIVATE "${VLC_PLUGIN_INCLUDE_DIR}")

set_target_properties(glitch_canvas PROPERTIES
  PREFIX ""
  OUTPUT_NAME "glitch_canvas")
