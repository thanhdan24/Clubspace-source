IF OBJECT_ID(N'dbo.CLUB_JOIN_REQUESTS', N'U') IS NULL
BEGIN
 CREATE TABLE dbo.CLUB_JOIN_REQUESTS (
  request_id bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
  club_id bigint NOT NULL REFERENCES dbo.CLUBS(club_id),
  user_id bigint NOT NULL REFERENCES dbo.USERS(user_id),
  request_status varchar(20) NOT NULL DEFAULT 'PENDING',
  message nvarchar(1000) NULL,
  review_note nvarchar(1000) NULL,
  created_at datetime2(0) NOT NULL,
  reviewed_by bigint NULL REFERENCES dbo.USERS(user_id),
  reviewed_at datetime2(0) NULL,
  CONSTRAINT UQ_CLUB_JOIN_REQUESTS_club_user UNIQUE(club_id,user_id),
  CONSTRAINT CK_CLUB_JOIN_REQUESTS_status CHECK(request_status IN ('PENDING','APPROVED','REJECTED'))
 );
 CREATE INDEX IX_CLUB_JOIN_REQUESTS_status ON dbo.CLUB_JOIN_REQUESTS(club_id,request_status);
END;
GO
