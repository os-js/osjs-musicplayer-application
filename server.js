const mm = require('music-metadata');
const fs = require('fs');

module.exports = (core, proc) => ({
  start: () => {},
  destroy: () => {},
  init: async () => {
    core.app.get(proc.resource('/metadata'), (req, res) => {
      core.make('osjs/vfs').realpath(req.query.path, req.session.user)
        .then(filename => {
          const stream = fs.createReadStream(filename);

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
