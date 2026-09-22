import { ZodError } from "zod";
import { ApiError, fail, json, has, isStaff, type Database } from "./core";
import { authRoute, context } from "./auth";
import { peopleRoute } from "./people";
import { joinRequestsRoute } from "./join-requests";
import { eventsRoute } from "./events";
import { financeRoute } from "./finance";
import { reportsRoute } from "./reports";
import { seedPreview } from "./seed";
export async function handleApi(
  req: Request,
  db: Database,
  env: any,
): Promise<Response> {
  try {
    const url = new URL(req.url),
      path = url.pathname.replace(/^\/api\//, "").replace(/\/$/, "");
    if (!["GET", "HEAD"].includes(req.method)) {
      const origin = req.headers.get("origin");
      fail(
        !origin || origin === url.origin,
        "Nguồn yêu cầu không hợp lệ.",
        403,
      );
      fail(
        req.headers.get("sec-fetch-site") !== "cross-site",
        "Yêu cầu khác nguồn bị từ chối.",
        403,
      );
      if (!path.startsWith("evidence"))
        fail(
          req.headers.get("content-type")?.includes("application/json"),
          "Cần gửi dữ liệu JSON.",
          415,
        );
    }
    await seedPreview(db, env);
    if (path === "health") {
      await db.prepare("SELECT 1 AS ok").first();
      return json({
        status: "ok",
        database: db.dialect || "d1",
        time: new Date().toISOString(),
      });
    }
    const auth = await authRoute(db, req, path, env);
    if (auth) return auth;
    const c = await context(db, req, env);
    if (path === "evidence" && req.method === "POST") {
      fail(has(c, "TREASURER"), "Chỉ thủ quỹ được tải chứng từ.", 403);
      fail(env.BUCKET, "Kho lưu chứng từ chưa được cấu hình.", 503);
      const form = await req.formData();
      const file = form.get("file") as File;
      fail(
        file && typeof file.arrayBuffer === "function",
        "Vui lòng chọn tệp.",
      );
      fail(
        file.size > 0 && file.size <= 10 * 1024 * 1024,
        "Tệp cần nhỏ hơn hoặc bằng 10 MB.",
      );
      const types: any = {
        "application/pdf": "pdf",
        "image/png": "png",
        "image/jpeg": "jpg",
      };
      fail(types[file.type], "Chỉ nhận PDF, PNG hoặc JPEG.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const signature =
        file.type === "application/pdf"
          ? String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-"
          : file.type === "image/png"
            ? bytes[0] === 137 &&
              bytes[1] === 80 &&
              bytes[2] === 78 &&
              bytes[3] === 71
            : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      fail(signature, "Nội dung tệp không khớp định dạng.");
      const key = `${c.club}/${crypto.randomUUID()}.${types[file.type]}`;
      await env.BUCKET.put(key, bytes, {
        httpMetadata: { contentType: file.type },
        customMetadata: {
          club_id: String(c.club),
          uploaded_by: String(c.user.user_id),
        },
      });
      return json({ evidence_url: "/api/evidence/" + key }, 201);
    }
    const ev = path.match(/^evidence\/(\d+)\/([a-f0-9-]+\.(pdf|png|jpg))$/);
    if (ev && req.method === "GET") {
      fail(
        Number(ev[1]) === c.club && isStaff(c),
        "Bạn không có quyền xem chứng từ này.",
        403,
      );
      fail(env.BUCKET, "Kho chứng từ chưa được cấu hình.", 503);
      const object = await env.BUCKET.get(`${ev[1]}/${ev[2]}`);
      fail(object, "Không tìm thấy tệp chứng từ.", 404);
      return new Response(object.body, {
        headers: {
          "Content-Type":
            object.httpMetadata?.contentType || "application/octet-stream",
          "Content-Disposition": `attachment; filename="chung-tu.${ev[3]}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    for (const handler of [
      joinRequestsRoute,
      peopleRoute,
      eventsRoute,
      financeRoute,
      reportsRoute,
    ]) {
      const result = await handler(c, path, req);
      if (result) return result;
    }
    return json({ error: "Không tìm thấy chức năng." }, 404);
  } catch (e: any) {
    if (e instanceof ApiError) return json({ error: e.message }, e.status);
    if (e instanceof ZodError)
      return json(
        {
          error: "Vui lòng kiểm tra các trường đã nhập.",
          fields: Object.fromEntries(
            e.issues.map((i) => [i.path.join("."), i.message]),
          ),
        },
        422,
      );
    const message = String(e.message || e);
    if (/UNIQUE|duplicate key|unique constraint/i.test(message))
      return json(
        {
          error:
            "Dữ liệu đã tồn tại. Vui lòng kiểm tra mã, tài khoản hoặc bản ghi trùng.",
        },
        409,
      );
    if (/CAPACITY/i.test(message))
      return json({ error: "Sự kiện đã đủ sức chứa." }, 409);
    if (/LOCKED_ATTENDANCE/i.test(message))
      return json({ error: "Điểm danh đã khóa." }, 409);
    if (
      /INVALID_STATE|CHECK constraint|FOREIGN KEY|CROSS_CLUB|INACTIVE_MEMBER/i.test(
        message,
      )
    )
      return json(
        {
          error:
            "Dữ liệu hoặc trạng thái không hợp lệ. Hãy tải lại và kiểm tra các trường liên quan.",
        },
        409,
      );
    console.error("[clubspace]", e);
    return json(
      {
        error:
          "Không thể xử lý yêu cầu lúc này. Dữ liệu bạn đang nhập vẫn được giữ; vui lòng thử lại.",
      },
      500,
    );
  }
}
