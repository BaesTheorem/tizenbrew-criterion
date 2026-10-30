# tizenbrew-criterion

A [TizenBrew](https://github.com/reisxd/TizenBrew) module that opens the Criterion Channel website on a Samsung TV and makes the remote work on it.

The site is built for a mouse. This module draws a cursor: the arrow keys move it (hold a key to speed up), Enter clicks what is under it, Return goes back, and the channel keys page up and down. Play, pause, stop, rewind and fast-forward act on the video, including inside the player frame. The colour keys jump to Home, Browse, Search and My List.

Install TizenBrew, add the module `gh/BaesTheorem/tizenbrew-criterion`, and sign in to the Criterion Channel with the on-screen keyboard once. There is no Samsung account anywhere in this path.

License: MIT.

## Standalone tile

`launcher/` is a tiny Tizen web app that hands off to TizenBrew with an app-control request for this module and exits, so the TV's home bar gets a "Criterion Channel" tile with its own icon. Build it with the Tizen CLI (`tizen package -t wgt -s <profile> -- launcher`) and install it over the developer bridge. It pins the module by commit, so bump `MODULE.moduleName` in `launcher/index.html` when the module is re-registered under a new commit.
