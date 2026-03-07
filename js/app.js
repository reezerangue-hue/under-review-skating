/**
 * Under Review Skating — Application Bootstrap
 */
(function init() {
  Nav.render();

  Router.add('/',                    () => renderHome());
  Router.add('/skater/:id',          ({ id })        => renderSkater({ id }));
  Router.add('/competition/:id',     ({ id })        => renderCompetition({ id }));
  Router.add('/protocol/:competition_id/:result_id', ({ competition_id, result_id }) => renderProtocol({ competition_id, result_id }));
  Router.add('/stats',               () => renderStats());
  Router.add('/events',              () => renderEvents());
  Router.add('/skaters',             () => renderSkaters());
  Router.add('/junior-eligibility',  () => renderJuniorEligibility());
  Router.add('/rankings',            () => renderRankings());

  Router.init();

  if (SheetsDB.isConfigured()) {
    SheetsDB.init().catch(() => {});
  }
})();
