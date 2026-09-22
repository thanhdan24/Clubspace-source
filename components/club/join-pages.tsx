"use client";
import { useState } from "react";
import { Building2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useApp,
  useResource,
  PageTitle,
  LoadState,
  EmptyState,
  Editor,
  DataTable,
  ActionButton,
  dateText,
  type Row,
} from "./shared";

export function DiscoverClubs() {
  const { club, mutate, refresh, switchClub, session } = useApp();
  const r = useResource("discover-clubs");
  const [selected, setSelected] = useState<Row | null>(null);
  return (
    <>
      <PageTitle
        eyebrow="KẾT NỐI CỘNG ĐỒNG"
        title="Khám phá câu lạc bộ"
        description={
          club
            ? "Tìm cộng đồng phù hợp và theo dõi yêu cầu tham gia của bạn."
            : "Bạn chưa tham gia câu lạc bộ nào. Chọn CLB yêu thích và gửi yêu cầu tham gia để bắt đầu."
        }
      >
        <Button variant="outline" onClick={refresh}>
          <RefreshCw size={16} /> Cập nhật trạng thái
        </Button>
      </PageTitle>
      <LoadState {...r}>
        {!r.data?.rows.length ? (
          <EmptyState
            title="Chưa có CLB nhận thành viên"
            description="Hãy quay lại khi có câu lạc bộ hoạt động."
          />
        ) : (
          <div className="club-cards">
            {r.data.rows.map((c: Row) => {
              const access =
                c.member_status === "ACTIVE" ||
                session.clubs.some(
                  (own: Row) => Number(own.club_id) === Number(c.club_id),
                );
              return (
                <section className="panel club-card" key={c.club_id}>
                  <span className="club-card-icon">
                    <Building2 />
                  </span>
                  <h2>{c.club_name}</h2>
                  <p>
                    {c.description ||
                      "Cùng gặp gỡ, học hỏi và tham gia các hoạt động của câu lạc bộ."}
                  </p>
                  <small>
                    {c.club_code} · Thành lập {dateText(c.founded_date)}
                  </small>
                  {access ? (
                    <ActionButton onClick={() => switchClub(Number(c.club_id))}>
                      Mở câu lạc bộ
                    </ActionButton>
                  ) : c.member_status ? (
                    <p>
                      Hồ sơ của bạn đang tạm ngừng hoặc đã rời CLB. Liên hệ
                      người quản lý để được hỗ trợ.
                    </p>
                  ) : c.request_status === "PENDING" ? (
                    <>
                      <span className="status status-PENDING">Chờ duyệt</span>
                      <p>
                        Yêu cầu đã được gửi. Chủ nhiệm hoặc cán bộ sẽ xem xét
                        đơn của bạn.
                      </p>
                    </>
                  ) : (
                    <>
                      {c.request_status === "REJECTED" && (
                        <p role="status">
                          Yêu cầu chưa được chấp nhận.{" "}
                          {c.review_note ||
                            "Bạn có thể bổ sung thông tin và gửi lại."}
                        </p>
                      )}
                      <Button onClick={() => setSelected(c)}>
                        {c.request_status === "REJECTED"
                          ? "Gửi lại yêu cầu"
                          : "Xin tham gia"}
                      </Button>
                    </>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </LoadState>
      {selected && (
        <Editor
          title={`Xin tham gia ${selected.club_name}`}
          initial={{ message: selected.message || "" }}
          fields={[
            {
              name: "message",
              label: "Giới thiệu và lý do muốn tham gia",
              type: "textarea",
              wide: true,
              maxLength: 1000,
              help: "Chủ nhiệm hoặc cán bộ sẽ xét duyệt yêu cầu của bạn.",
            },
          ]}
          onClose={() => setSelected(null)}
          onSave={(v: Row) =>
            mutate(`discover-clubs/${selected.club_id}/join`, v)
          }
        />
      )}
    </>
  );
}

export function JoinRequests() {
  const { mutate } = useApp();
  const [page, setPage] = useState(1);
  const r = useResource(`join-requests?page=${page}`);
  const [review, setReview] = useState<Row | null>(null);
  return (
    <>
      <PageTitle
        eyebrow="QUẢN LÝ THÀNH VIÊN"
        title="Yêu cầu tham gia"
        description="Duyệt đơn để tự động tạo hồ sơ và cấp quyền thành viên trong CLB."
      />
      <section className="panel">
        <LoadState {...r}>
          <DataTable
            data={r.data}
            page={page}
            setPage={setPage}
            columns={[
              {
                key: "full_name",
                title: "NGƯỜI ĐĂNG KÝ",
                render: (u) => (
                  <>
                    <strong>{u.full_name}</strong>
                    <p>{u.student_code || u.username}</p>
                  </>
                ),
              },
              { key: "message", title: "GIỚI THIỆU" },
              {
                key: "created_at",
                title: "NGÀY GỬI",
                render: (u) => dateText(u.created_at, true),
              },
              {
                key: "actions",
                title: "XÉT DUYỆT",
                render: (u) => (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setReview({ ...u, status: "APPROVED" })}
                    >
                      Duyệt
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setReview({ ...u, status: "REJECTED" })}
                    >
                      Từ chối
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </LoadState>
      </section>
      {review && (
        <Editor
          title={`${review.status === "APPROVED" ? "Duyệt" : "Từ chối"} yêu cầu của ${review.full_name}`}
          fields={[
            {
              name: "review_note",
              label: "Phản hồi cho người đăng ký",
              type: "textarea",
              wide: true,
              maxLength: 1000,
            },
          ]}
          onClose={() => setReview(null)}
          onSave={async (v: Row) => {
            await mutate(
              `join-requests/${review.request_id}`,
              { ...v, status: review.status },
              "PATCH",
            );
            setPage(1);
          }}
        />
      )}
    </>
  );
}
