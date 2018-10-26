const mm = require('music-metadata');

module.exports = (core, proc) => ({
  start: () => {},
  destroy: () => {},
  init: async () => {
    core.app.get(proc.resource('/metadata'), (req, res) => {
      core.make('osjs/vfs').readfile(req.query, {}, req.session)
        .then(stream => {
          return mm.parseStream(stream, undefined, {skipCovers: true})
            .then(metadata => res.json({error: null, metadata}))
            .catch(error => res.json({error}));
        })
        .catch(error => {
          console.warn(error);

          res.json({error: 'Fatal error'});
        });
    });
  }
});
