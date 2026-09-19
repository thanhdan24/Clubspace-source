-- Additive migration. Run inside the existing StudentClubManagement database.
-- No original table, column, row, key or view is replaced.
IF OBJECT_ID(N'dbo.AUTH_SESSIONS',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.AUTH_SESSIONS (
  token_hash varchar(64) NOT NULL PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES dbo.USERS(user_id),
  expires_at bigint NOT NULL,
  created_at datetime2(0) NOT NULL
 );
 CREATE INDEX IX_AUTH_SESSIONS_user ON dbo.AUTH_SESSIONS(user_id);
END;
GO
IF OBJECT_ID(N'dbo.AUTH_ATTEMPTS',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.AUTH_ATTEMPTS (
  attempt_id bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
  identifier varchar(64) NOT NULL,
  attempted_at bigint NOT NULL
 );
 CREATE INDEX IX_AUTH_ATTEMPTS_identifier_time ON dbo.AUTH_ATTEMPTS(identifier,attempted_at);
END;
GO
IF OBJECT_ID(N'dbo.APP_SETUP',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.APP_SETUP (setup_id int NOT NULL PRIMARY KEY,completed_at nvarchar(30) NOT NULL);
END;
GO
