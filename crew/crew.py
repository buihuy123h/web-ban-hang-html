# -*- coding: utf-8 -*-
"""Crew "Đồ Cũ Quang Huy" — quy trình 4 giai đoạn theo AGENTS.md, chạy bằng CrewAI.

Luồng tuần tự (Process.sequential): analyst -> be_coder -> fe_coder -> tester.
Model mặc định đúng bảng AGENTS.md mục 2, gọi qua OpenRouter bằng 1 key duy nhất.

Tương tác giữa agent (delegation — "cách A"): be_coder/fe_coder/tester bật
allow_delegation, khi chạy được cấp tool hỏi co-worker; quy tắc: chỉ HỎI làm rõ
theo định tuyến AGENTS.md mục 4, không chuyển việc cho agent khác làm thay.
analyst giữ tắt (giai đoạn đầu, không có agent trước để hỏi).

Chạy từ GỐC REPO (PowerShell):
    crew/.venv/Scripts/python.exe crew/crew.py "yêu cầu task"
    crew/.venv/Scripts/python.exe crew/crew.py --stages analyst,be,tester "task thuần BE"
    crew/.venv/Scripts/python.exe crew/crew.py --stages analyst,fe,tester "task thuần FE"

API key cấu hình trong crew/.env (xem crew/.env.example và crew/README.md).
Yêu cầu dài: truyền đường dẫn tới file .txt/.md chứa yêu cầu.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # gốc repo

# ------------------------------------------------------------------ models --
DEFAULT_MODELS = {  # đúng bảng AGENTS.md mục 2
    "ANALYST": "openai/gpt-5.6-terra",
    "BE_CODER": "z-ai/glm-5.3",
    "FE_CODER": "moonshotai/kimi-k2.7-code",
    "TESTER": "anthropic/claude-opus-5",
}


def make_llm(role: str, llm_class):
    """Model theo AGENTS.md; ghi đè qua .env (VD: MODEL_TESTER=...).

    Có OPENROUTER_API_KEY -> cả 4 model chạy qua OpenRouter bằng đúng 1 key,
    giữ nguyên model ID như bảng AGENTS.md. Không có -> truyền nguyên cho
    LiteLLM (khi đó phải tự đặt key từng hãng + chỉnh MODEL_* đúng định dạng).
    """
    model = os.getenv(f"MODEL_{role}", DEFAULT_MODELS[role])
    if os.getenv("OPENROUTER_API_KEY") and not model.startswith("openrouter/"):
        model = f"openrouter/{model}"
    return llm_class(model=model, temperature=0.2)


# ------------------------------------------------------------------ agents --
COMMON = (
    "Bối cảnh repo 'Đồ Cũ Quang Huy': FE React 18 + Vite 5 + react-router-dom 6 "
    "nằm trong client/, BE Express 4 nằm trong server/, data ở "
    "server/data/products.json, ảnh ở server/public/images/. Thư mục làm việc "
    "hiện tại là GỐC REPO. BẮT BUỘC đọc AGENTS.md và README.md ở gốc repo trước "
    "khi làm việc. Tài liệu và UI dùng tiếng Việt; tên biến/hàm/commit dùng "
    "tiếng Anh. Không tự commit/push/deploy. Chỉ trao đổi qua format "
    "[HANDOFF]/[BUG] như AGENTS.md mục 4."
)

# Cách A — tương tác giữa agent: be/fe/tester bật allow_delegation nên khi chạy
# được CrewAI cấp tool "Ask question to coworker" / "Delegate work to coworker".
# Quy tắc ghi vào backstory: chỉ HỎI làm rõ, không chuyển việc làm thay.
DELEGATION_RULES = (
    " Khi thiếu thông tin, được dùng tool 'Ask question to coworker' để gửi CÂU "
    "HỎI cho đúng agent theo định tuyến AGENTS.md mục 4: nghiệp vụ mơ hồ/mâu "
    "thuẫn -> analyst; API/data/lỗi 500 -> be-coder; UI/logic FE -> fe-coder "
    "(tham số coworker nhận theo role, VD 'Backend Developer (be-coder)'). "
    "TUYỆT ĐỐI không dùng 'Delegate work to coworker' để chuyển việc của mình "
    "cho agent khác làm thay — mỗi agent có giới hạn file được sửa riêng và "
    "phải tự hoàn thành phần việc của mình. Chỉ hỏi khi thật sự cần (tối đa "
    "1-2 câu), hỏi xong tự chốt và làm tiếp; bàn giao cuối vẫn theo format "
    "[HANDOFF]/[BUG] như thường lệ."
)

def build_agents():
    """Chỉ nạp cấu hình và tạo CrewAI objects sau khi CLI đã hợp lệ."""
    from crewai import Agent, LLM
    from crewai.tools import BaseTool
    from crewai_tools import DirectoryReadTool, FileReadTool, FileWriterTool
    from dotenv import load_dotenv

    class NpmCommandTool(BaseTool):
        """Chạy một tập lệnh npm hữu hạn từ gốc repo, không mở shell tùy ý."""

        name: str = "Chạy lệnh kiểm tra npm của dự án"
        description: str = (
            "Chạy đúng một action trong: test, build, verify, smoke. "
            "Các action được ánh xạ sang npm.cmd và luôn chạy tại gốc repo; "
            "không nhận câu lệnh shell tùy ý."
        )

        def _run(self, action: str) -> str:
            commands = {
                "test": ("npm.cmd", "test"),
                "build": ("npm.cmd", "run", "build"),
                "verify": ("npm.cmd", "run", "verify"),
                "smoke": ("npm.cmd", "run", "smoke"),
            }
            normalized = action.strip().lower()
            command = commands.get(normalized)
            if command is None:
                return (
                    "Action không hợp lệ. Chỉ được dùng một trong: "
                    + ", ".join(commands)
                    + "."
                )

            try:
                completed = subprocess.run(
                    command,
                    cwd=ROOT,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=600,
                    check=False,
                    shell=False,
                )
            except subprocess.TimeoutExpired:
                return f"Lệnh {' '.join(command)} đã quá thời gian 600 giây."
            except OSError as exc:
                return f"Không thể chạy {' '.join(command)}: {exc}"

            output = "\n".join(
                part for part in (completed.stdout, completed.stderr) if part
            )
            return f"Exit code: {completed.returncode}\n{output}".rstrip()

    load_dotenv(Path(__file__).resolve().parent / ".env")
    read_tools = [FileReadTool(base_dir=str(ROOT)), DirectoryReadTool(directory=str(ROOT))]

    analyst = Agent(
        role="BA — phân tích nghiệp vụ (analyst)",
        goal=(
            "Chuyển yêu cầu của chủ repo thành task file trong docs/tasks/ đủ chi "
            "tiết để BE, FE, QA làm việc mà không phải hỏi lại nghiệp vụ."
        ),
        backstory=(
            "Bạn là Business Analyst kỷ luật, tuân thủ tuyệt đối AGENTS.md. " + COMMON
            + " Được sửa: docs/tasks/**. Bị cấm: sửa code FE/BE, chạy build/deploy. "
            "Task file bắt buộc gồm: mục tiêu & bối cảnh, user story, luật nghiệp vụ "
            "(kể cả trường hợp biên), hợp đồng API nếu có (method/path/body/response "
            "JSON/mã lỗi — ràng buộc cả BE lẫn FE), phạm vi, acceptance criteria dạng "
            "Given/When/Then. Nếu yêu cầu mơ hồ/mâu thuẫn, ghi rõ câu hỏi cho chủ "
            "repo ở đầu file. Bạn cũng có thể NHẬN câu hỏi từ BE/FE/QA qua "
            "delegation: trả lời ngắn gọn, đúng nghiệp vụ AGENTS.md và repo đã "
            "đọc; khi trả lời câu hỏi thì KHÔNG tạo/sửa file nào."
        ),
        llm=make_llm("ANALYST", LLM),
        tools=[*read_tools, FileWriterTool(base_dir=str(ROOT))],
        # Cách A: analyst là giai đoạn đầu, không có agent trước để hỏi —
        # giữ allow_delegation=False để tránh vòng lặp hỏi qua lại.
        allow_delegation=False,
        max_iter=15,
    )

    be_coder = Agent(
        role="Backend Developer (be-coder)",
        goal="Triển khai API đúng 100% hợp đồng trong task file; npm.cmd test pass trước khi bàn giao.",
        backstory=(
            "Bạn là Backend Developer Express 4 kỷ luật, tuân thủ tuyệt đối AGENTS.md. "
            + COMMON
            + " Được sửa: server/** (public/images/ chỉ thêm ảnh khi task yêu cầu; "
            "JSON chỉ lưu đường dẫn /images/...). Bị cấm: sửa client/**, đổi JSON "
            "data sang DB khác khi chưa duyệt. Test bằng node:test (0 dependency) "
            "trong server/test/. Xong: viết [HANDOFF] be-coder -> ... kèm kết quả "
            "npm.cmd test và request/response mẫu đã chạy được." + DELEGATION_RULES
        ),
        llm=make_llm("BE_CODER", LLM),
        tools=[*read_tools, FileWriterTool(base_dir=str(ROOT)), NpmCommandTool()],
        allow_delegation=True,  # cách A: được hỏi analyst/fe/tester khi cần làm rõ
        max_iter=25,
    )

    fe_coder = Agent(
        role="Frontend Developer (fe-coder)",
        goal="Làm UI hoàn chỉnh đúng task file + design system; npm.cmd run build pass trước khi bàn giao.",
        backstory=(
            "Bạn là Frontend Developer React 18 + Vite 5 kỷ luật, tuân thủ tuyệt đối "
            "AGENTS.md. " + COMMON
            + " Được sửa: client/** (trừ client/dist/). Bị cấm: sửa server/**, thêm "
            "thư viện/UI framework chưa duyệt. Tái sử dụng component sẵn có theo "
            "design system client/docs/; trang mới lazy-load trong App.jsx; gọi API "
            "chỉ qua lớp client/src/api/; ảnh qua helper client/src/data/"
            "productImages.js; không hardcode http://localhost:3000. Xong: viết "
            "[HANDOFF] fe-coder -> tester kèm các bước thao tác để QA test."
            + DELEGATION_RULES
        ),
        llm=make_llm("FE_CODER", LLM),
        tools=[*read_tools, FileWriterTool(base_dir=str(ROOT)), NpmCommandTool()],
        allow_delegation=True,  # cách A: được hỏi analyst/be/tester khi cần làm rõ
        max_iter=25,
    )

    tester = Agent(
        role="QA Engineer (tester)",
        goal=(
            "Đối chiếu TỪNG acceptance criteria của task file; PASS thì ghi "
            "docs/qa/<task>.md, FAIL thì viết bug report đúng format và định tuyến."
        ),
        backstory=(
            "Bạn là QA kỷ luật, tuân thủ tuyệt đối AGENTS.md. " + COMMON
            + " Được sửa: server/test/**, tools/scripts/**, docs/qa/**. Bị cấm: sửa "
            "code production, sửa test cho 'đẹp số'. API test: node:test trong "
            "server/test/. UI: Playwright theo quy ước tools/README.md. Chạy npm.cmd "
            "run verify; nếu dính UI thì chỉ chạy npm.cmd run smoke khi server dự án "
            "đã được chủ repo hoặc QA khởi động an toàn. FAIL -> bug report [BUG] đủ "
            "Severity/Where/Steps/Expected/Actual/Evidence/Assign to, TUYỆT ĐỐI "
            "không tự sửa code production." + DELEGATION_RULES
        ),
        llm=make_llm("TESTER", LLM),
        tools=[*read_tools, FileWriterTool(base_dir=str(ROOT)), NpmCommandTool()],
        allow_delegation=True,  # cách A: được hỏi be/fe/analyst khi cần làm rõ
        max_iter=25,
    )

    return {
        "analyst": analyst,
        "be": be_coder,
        "fe": fe_coder,
        "tester": tester,
    }

# ------------------------------------------------------------------- tasks --
def build_tasks(stages, requirement, agents_by_stage, task_class):
    """Task theo quy trình AGENTS.md mục 3 — context nối tiếp, đúng thứ tự."""
    today = date.today().isoformat()
    ctx, tasks = [], []
    analyst = agents_by_stage["analyst"]
    be_coder = agents_by_stage["be"]
    fe_coder = agents_by_stage["fe"]
    tester = agents_by_stage["tester"]

    if "analyst" in stages:
        t = task_class(
            description=(
                'YÊU CẦU GỐC TỪ CHỦ REPO:\n"""\n' + requirement + '\n"""\n\n'
                "1) Đọc AGENTS.md + README.md ở gốc repo; đọc thêm docs/ và code "
                "liên quan (chỉ đọc, không sửa).\n"
                "2) Tạo file docs/tasks/" + today + "-<ten-task-kebab-case>.md "
                "đúng cấu trúc bắt buộc nêu trong role của bạn.\n"
                "3) Trả về: đường dẫn file vừa tạo + tóm tắt hợp đồng API (nếu "
                "có) + danh sách acceptance criteria."
            ),
            expected_output=(
                "Đường dẫn task file trong docs/tasks/ kèm tóm tắt: mục tiêu, "
                "hợp đồng API (nếu có), danh sách acceptance criteria dạng "
                "Given/When/Then."
            ),
            agent=analyst,
        )
        tasks.append(t)
        ctx.append(t)

    if "be" in stages:
        t = task_class(
            description=(
                "1) Lấy đường dẫn task file từ output giai đoạn ANALYST trong "
                "context, rồi đọc file đó.\n"
                "2) Đọc server/server.js + server/data/products.json.\n"
                "3) Triển khai đúng 100% hợp đồng API (không tự đổi path/field); "
                "data sửa trong server/data/products.json, ảnh vào "
                "server/public/images/.\n"
                "4) Viết/cập nhật test node:test trong server/test/.\n"
                "5) Dùng command tool với action 'test' (npm.cmd test) — phải pass hết mới bàn giao.\n"
                "6) Viết [HANDOFF] be-coder -> fe-coder|tester: Status, "
                "Artifacts, Verify (kết quả npm.cmd test), request/response mẫu."
            ),
            expected_output=(
                "Handoff [HANDOFF] ... Status: DONE kèm file đã sửa, kết quả "
                "npm.cmd test (VD: 21/21 pass) và request/response mẫu đã chạy được."
            ),
            agent=be_coder,
            context=ctx,
        )
        tasks.append(t)
        ctx.append(t)

    if "fe" in stages:
        t = task_class(
            description=(
                "1) Lấy đường dẫn task file từ context (output ANALYST), đọc file.\n"
                "2) Đọc design system client/docs/ + cấu trúc client/src/.\n"
                "3) Làm UI hoàn chỉnh: tái sử dụng component sẵn có, trang mới "
                "lazy-load trong App.jsx, gọi API qua client/src/api/, ảnh qua "
                "client/src/data/productImages.js.\n"
                "4) Dùng command tool với action 'build' (npm.cmd run build) — phải pass mới bàn giao.\n"
                "5) Viết [HANDOFF] fe-coder -> tester: Status, Artifacts, Verify "
                "(kết quả build), các bước thao tác để QA test."
            ),
            expected_output=(
                "Handoff [HANDOFF] ... Status: DONE kèm file đã sửa, kết quả "
                "npm.cmd run build pass và các bước thao tác cho QA test UI."
            ),
            agent=fe_coder,
            context=ctx,
        )
        tasks.append(t)
        ctx.append(t)

    if "tester" in stages:
        t = task_class(
            description=(
                "1) Lấy task file từ context, liệt kê TỪNG acceptance criteria.\n"
                "2) Đối chiếu từng criteria: API -> node:test trong server/test/; "
                "UI -> Playwright theo tools/README.md.\n"
                "3) Dùng command tool với action 'verify'; nếu dính UI và server dự án "
                "đã được khởi động an toàn, dùng action 'smoke'.\n"
                "4) PASS -> tạo docs/qa/<task>.md ghi kết quả từng criteria, trả "
                "về '✅ DONE'. FAIL -> bug report [BUG] đúng format AGENTS.md "
                "mục 4 (định tuyến đúng agent) và trả về danh sách bug.\n"
                "Tuyệt đối không tự sửa code production."
            ),
            expected_output=(
                "PASS: đường dẫn docs/qa/<task>.md + '✅ DONE'. FAIL: danh sách "
                "bug report [BUG] đã định tuyến đúng agent theo AGENTS.md mục 4."
            ),
            agent=tester,
            context=ctx,
        )
        tasks.append(t)
        ctx.append(t)

    return tasks


# -------------------------------------------------------------------- main --
def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(
        description="Crew 'Đồ Cũ Quang Huy' — quy trình 4 giai đoạn theo AGENTS.md"
    )
    parser.add_argument(
        "requirement",
        nargs="?",
        default="",
        help="Yêu cầu task (text trong ngoặc kép, hoặc đường dẫn file .txt/.md)",
    )
    parser.add_argument(
        "--stages",
        default="analyst,be,fe,tester",
        help=(
            "Giai đoạn chạy, phân tách bằng phẩy. Mặc định: analyst,be,fe,tester. "
            "Rút gọn theo AGENTS.md: 'analyst,be,tester' (thuần BE), "
            "'analyst,fe,tester' (thuần FE)."
        ),
    )
    args = parser.parse_args()

    req_path = ROOT / args.requirement
    requirement = (
        req_path.read_text(encoding="utf-8").strip()
        if req_path.is_file()
        else args.requirement.strip()
    )
    if not requirement:
        parser.error("Yêu cầu trống — truyền text hoặc đường dẫn file chứa yêu cầu.")

    valid = ("analyst", "be", "fe", "tester")
    stages = [s.strip().lower() for s in args.stages.split(",") if s.strip()]
    if not stages or any(s not in valid for s in stages):
        parser.error(f"--stages không hợp lệ. Chỉ chọn trong: {', '.join(valid)}.")
    if "analyst" not in stages or "tester" not in stages:
        parser.error(
            "Theo AGENTS.md mục 3, 'analyst' (giai đoạn 1) và 'tester' (gate "
            "chất lượng) luôn bắt buộc; chỉ được bỏ 'be' hoặc 'fe'."
        )
    canonical_stages = [stage for stage in valid if stage in stages]
    if stages != canonical_stages:
        parser.error(
            "--stages phải đúng thứ tự analyst,be,fe,tester và không được lặp."
        )

    from crewai import Crew, Process, Task

    agents_by_stage = build_agents()
    tasks = build_tasks(stages, requirement, agents_by_stage, Task)
    agents = [agents_by_stage[s] for s in stages]
    crew = Crew(agents=agents, tasks=tasks, process=Process.sequential, verbose=True)

    print(f"[crew] Giai đoạn: {' -> '.join(stages)}")
    result = crew.kickoff()
    final_text = getattr(result, "raw", None) or str(result)

    out_dir = Path(__file__).resolve().parent / "output"
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d-%H%M%S")
    out_file = out_dir / f"{stamp}-{'-'.join(stages)}.md"
    out_file.write_text(
        f"# Crew output — {stamp}\n\n## Yêu cầu\n\n{requirement}\n\n"
        f"## Giai đoạn\n\n{' -> '.join(stages)}\n\n"
        f"## Kết quả cuối cùng\n\n{final_text}\n",
        encoding="utf-8",
    )

    print("\n" + "=" * 60)
    print("KẾT QUẢ CUỐI CÙNG:\n")
    print(final_text)
    print(f"\nFull output đã lưu: crew/output/{out_file.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())



