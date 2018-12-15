/*!
 * OS.js - JavaScript Cloud/Web Desktop Platform
 *
 * Copyright (c) 2011-2018, Anders Evenrud <andersevenrud@gmail.com>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @author  Anders Evenrud <andersevenrud@gmail.com>
 * @licence Simplified BSD License
 */

import {
  h,
  app
} from 'hyperapp';

import {
  Box,
  Button,
  Toolbar,
  Menubar,
  MenubarItem,
  RangeField
} from '@osjs/gui';

const formatTime = (secs) => {
  const hr  = Math.floor(secs / 3600);
  const min = Math.floor((secs - (hr * 3600)) / 60);
  const sec = Math.floor(secs - (hr * 3600) -  (min * 60));
  return `${min < 10 ? '0' + min : min}:${sec < 10 ? '0' + sec : sec}`;
};

const formatMetadata = (metadata, defaultFormatted) => {
  if (metadata && metadata.common) {
    const pick = ['artist', 'album', 'title']
      .map(key => metadata.common[key])
      .filter(value => !!value);

    if (pick.length > 1) {
      return pick.join(' - ');
    }
  }

  return defaultFormatted;
};

const view = (core, proc, win, audio) => {
  const _ = core.make('osjs/locale').translate;

  return (state, actions) => h(Box, {}, [
    h(Menubar, {}, [
      h(MenubarItem, {
        onclick: ev => actions.menu(ev)
      }, _('LBL_FILE'))
    ]),
    h(Box, {grow: 1, shrink: 1, align: 'center', justify: 'center', orientation: 'horizontal'}, [
      h(Box, {}, [
        h('div', {style: {textAlign: 'center', fontWeight: 'bold'}}, `${state.trackTitle}`)
      ]),
      h(Box, {}, [
        h('div', {style: {textAlign: 'center'}}, `${formatTime(state.currentTime)} / ${formatTime(state.trackLength)}`)
      ]),
    ]),
    h(RangeField, {
      value: String(state.currentTime),
      max: String(state.trackLength),
      style: {width: '80%'},
      box: {align: 'center', justify: 'center'},
      onchange: (ev, val) => (audio.currentTime = val)
    }),
    h(Toolbar, {justify: 'center'}, [
      h(Button, {label: 'Prev', disabled: true}),
      h(Button, {label: 'Rew', disabled: true}),
      h(Button, {label: 'Pause', disabled: !state.playing, onclick: () => audio.pause()}),
      h(Button, {label: 'Play', disabled: state.playing, onclick: () => audio.play()}),
      h(Button, {label: 'Fwd', disabled: true}),
      h(Button, {label: 'Next', disabled: true})
    ])
  ]);
};

OSjs.make('osjs/packages').register('MusicPlayer', (core, args, options, metadata) => {
  const vfs = core.make('osjs/vfs');
  const proc = core.make('osjs/application', {
    args,
    options,
    metadata
  });

  const readMetadata = body => proc.request('/metadata', {method: 'get', body});
  const title = core.make('osjs/locale')
    .translatableFlat(metadata.title);

  proc.createWindow({
    id: 'MusicPlayerWindow',
    title,
    icon: proc.resource(metadata.icon),
    dimension: {width: 400, height: 200}
  })
    .on('destroy', () => proc.destroy())
    .on('render', (win) => win.focus())
    .render(($content, win) => {
      const audio = document.createElement('audio');

      const _ = core.make('osjs/locale').translate;
      const basic = core.make('osjs/basic-application', proc, win, {
        defaultFilename: null
      });

      const a = app({
        playing: false,
        trackTitle: '(no track loaded)',
        metadata: {},
        trackLength: 0,
        currentTime: 0
      }, {
        setMetadata: metadata => state => ({metadata}),
        setPlaying: playing => state => ({playing}),
        setTrackLength: trackLength => state => ({trackLength}),
        setTrackTitle: trackTitle => state => ({trackTitle}),
        setCurrentTime: currentTime => state => ({currentTime}),

        menu: ev => (state, actions) => {
          core.make('osjs/contextmenu').show({
            position: ev.target,
            menu: [
              {label: _('LBL_OPEN'), onclick: () => actions.menuOpen()},
              {label: _('LBL_QUIT'), onclick: () => actions.menuQuit()}
            ]
          });
        },

        menuOpen: () => () => basic.createOpenDialog(),
        menuQuit: () => () => proc.destroy(),

        play: url => () => {
          audio.pause();
          audio.currentTime = 0;
          audio.src = url;
          audio.play();
        },

        load: file => (state, actions) => {
          a.setMetadata({});
          a.setTrackTitle(file.filename);

          vfs.url(file)
            .then(url => {
              actions.play(url);

              readMetadata(file)
                .then(({metadata}) => {
                  a.setMetadata(metadata);
                  a.setTrackTitle(formatMetadata(metadata, file.filename));
                });
            });
        }
      }, view(core, proc, win, audio), $content);

      audio.addEventListener('ended', () => a.setPlaying(false));
      audio.addEventListener('play', () => a.setPlaying(true));
      audio.addEventListener('pause', () => a.setPlaying(false));
      audio.addEventListener('timeupdate', (ev) => a.setCurrentTime(ev.target.currentTime));
      audio.addEventListener('loadeddata', (ev) => {
        a.setTrackLength(ev.target.duration);
      });

      audio.addEventListener('error', () => a.setPlaying(false));

      win.on('drop', (ev, data) => {
        if (data.isFile && data.mime) {
          const found = metadata.mimes.find(m => (new RegExp(m)).test(data.mime));
          if (found) {
            basic.open(data);
          }
        }
      });

      proc.on('destroy', () => basic.destroy());
      proc.on('destroy', () => {
        if (audio) {
          audio.pause();
        }
        audio.remove();
      });
      basic.on('open-file', a.load);
      basic.init();
    });

  return proc;
});
