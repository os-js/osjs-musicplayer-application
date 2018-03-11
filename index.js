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
  BoxContainer,
  Button,
  Toolbar,
  Input
} from '@osjs/gui';

const formatTime = (secs) => {
  const hr  = Math.floor(secs / 3600);
  const min = Math.floor((secs - (hr * 3600)) / 60);
  const sec = Math.floor(secs - (hr * 3600) -  (min * 60));
  return `${min < 10 ? '0' + min : min}:${sec < 10 ? '0' + sec : sec}`;
}

const view = (core, proc, win, audio) =>
  (state, actions) => h(Box, {}, [
    h(BoxContainer, {grow: 1, shrink: 1}, [
      h(Box, {align: 'center', justify: 'center'}, [
        h(BoxContainer, {}, [
          h('div', {style: {textAlign: 'center', fontWeight: 'bold'}}, `${state.trackTitle}`)
        ]),
        h(BoxContainer, {}, [
          h('div', {style: {textAlign: 'center'}}, `${formatTime(state.currentTime)} / ${formatTime(state.trackLength)}`)
        ]),
      ])
    ]),
    h(BoxContainer, {grow: 1, align: 'center', justify: 'center', style: {display: 'flex'}}, [
      h(Input, {
        type: 'range',
        value: String(state.currentTime),
        max: String(state.trackLength),
        style: {width: '80%'},
        onchange: (val) => (audio.currentTime = val)
      })
    ]),
    h(BoxContainer, {}, [
      h(Toolbar, {justify: 'center'}, [
        h(Button, {label: 'Prev', disabled: true}),
        h(Button, {label: 'Rew', disabled: true}),
        h(Button, {label: 'Pause', disabled: !state.playing, onclick: () => audio.pause()}),
        h(Button, {label: 'Play', disabled: state.playing, onclick: () => audio.play()}),
        h(Button, {label: 'Fwd', disabled: true}),
        h(Button, {label: 'Next', disabled: true})
      ])
    ])
  ]);

const actions = (core, proc, win, audio) => {
  return {
    setPlaying: playing => state => ({playing}),
    setTrackLength: trackLength => state => ({trackLength}),
    setTrackTitle: trackTitle => state => ({trackTitle}),
    setCurrentTime: currentTime => state => ({currentTime})
  };
};

const playFile = (proc, win, audio, {filename, url}) => {
  audio.pause();
  audio.currentTime = 0;
  audio.src = url;
  audio.play();
  win.setTitle(`${proc.metadata.title.en_EN} - ${filename}`);
};

const openFile = async (core, proc, win, a, audio, file) => {
  const url = await core.make('osjs/vfs').url(file.path);
  const ref = Object.assign({}, file, {url});

  if (file.mime.match(/^audio/)) {
    playFile(proc, win, audio, ref);
  }

  proc.args.file = file;
};

OSjs.make('osjs/packages').register('MusicPlayer', (core, args, options, metadata) => {
  const proc = core.make('osjs/application', {
    args,
    options,
    metadata
  });

  const state = {
    playing: false,
    trackTitle: '(no track loaded)',
    trackLength: 0,
    currentTime: 0
  };

  proc.createWindow({
    id: 'MusicPlayerWindow',
    title: metadata.title.en_EN,
    state: {
      dimension: {width: 400, height: 200}
    }
  })
    .on('destroy', () => proc.destroy())
    .on('render', (win) => win.focus())
    .render(($content, win) => {
      const audio = document.createElement('audio');
      const a = app(state,
          actions(core, proc, win, audio),
          view(core, proc, win, audio),
          $content);

      audio.addEventListener('ended', () => a.setPlaying(false));
      audio.addEventListener('play', () => a.setPlaying(true));
      audio.addEventListener('pause', () => a.setPlaying(false));
      audio.addEventListener('timeupdate', (ev) => a.setCurrentTime(ev.target.currentTime));
      audio.addEventListener('loadeddata', (ev) => {
        a.setTrackLength(ev.target.duration);
        a.setTrackTitle(proc.args.file.filename);
      });
      audio.addEventListener('error', () => a.setPlaying(false));

      if (args.file) {
        openFile(core, proc, win, a, audio, args.file);
      }
    })

  return proc;
});
