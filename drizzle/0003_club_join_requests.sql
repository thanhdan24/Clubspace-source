CREATE TABLE CLUB_JOIN_REQUESTS (
 request_id INTEGER PRIMARY KEY AUTOINCREMENT,
 club_id INTEGER NOT NULL REFERENCES CLUBS(club_id),
 user_id INTEGER NOT NULL REFERENCES USERS(user_id),
 request_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(request_status IN ('PENDING','APPROVED','REJECTED')),
 message TEXT,
 review_note TEXT,
 created_at TEXT NOT NULL,
 reviewed_by INTEGER REFERENCES USERS(user_id),
 reviewed_at TEXT,
 UNIQUE(club_id,user_id)
);
--> statement-breakpoint
CREATE INDEX IX_CLUB_JOIN_REQUESTS_status ON CLUB_JOIN_REQUESTS(club_id,request_status);
