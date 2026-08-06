-- TournamentPhoto is queried by tournamentId on nearly every tournament page
-- load (layout, gallery, photos API) but had no index on that column, unlike
-- its sibling models (TournamentMessage, TournamentGroup, ChatBan, etc.).
CREATE INDEX IF NOT EXISTS "TournamentPhoto_tournamentId_idx"
  ON "TournamentPhoto" ("tournamentId");
