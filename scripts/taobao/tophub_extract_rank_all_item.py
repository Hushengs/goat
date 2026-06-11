#!/usr/bin/env python3
"""
Fetch the Taobao/Tmall hot-sales ranking from TopHub.

Flow:
1. Open the homepage.
2. Locate the "淘宝·天猫 / 热销总榜" entry.
3. Open the target page.
4. Extract all rows under class="jc rank-all-item".
5. Write the result into a text file.

This script uses only the Python standard library.
"""
# 该脚本用于自动抓取 TopHub 今日热榜上的“淘宝·天猫 / 热销总榜”商品信息，并输出至本地文本文件。
# 
# 功能流程为：
# 1. 打开 TopHub 首页，查找“淘宝·天猫 / 热销总榜”入口链接；
# 2. 跳转至对应榜单页面；
# 3. 从页面 HTML 中定位 class="jc rank-all-item" 的所有商品条目；
# 4. 解析每个榜单条目的排名、标题、链接、描述等字段；
# 5. 以文本形式输出所有榜单商品信息。
# 
# 技术细节：
# - 全部使用 Python 标准库，无第三方依赖；
# - 基于 urllib/request 进行页面请求，支持自定义请求头模拟浏览器访问；
# - 基于 html.parser.HTMLParser 子类对目标页面内容进行解析，无需额外依赖；
# - 适配页面结构变动抛出详细错误提示，避免错误数据输出；
# - 支持通过参数指定首页/目标榜单页 URL 及输出文件路径，便于本地调试或自动化脚本集成；
# - 兼容 Python 3.8 及以上版本，所有类型注解可选。
# 
# 文件结构说明：
# - DEFAULT_HOMEPAGE_URL: TopHub 首页地址；
# - DEFAULT_FALLBACK_TARGET_URL: 若首页入口查找失败时的榜单页备用直链；
# - REQUEST_HEADERS: 模拟主流浏览器请求头，减少反爬拦截风险；
# - ExtractionError: 抓取或解析流程出现异常时的自定义错误类型；
# - RankAllItemParser: 继承自 HTMLParser 的自定义解析器，专门处理榜单页面的条目提取逻辑；
# - 其余功能函数与命令行参数解析在后续代码定义。
# 
# 使用方法（命令行示例）：
# python scripts/taobao/tophub_extract_rank_all_item.py
# python scripts/taobao/tophub_extract_rank_all_item.py --output your_output.txt


from __future__ import annotations

import argparse
import html
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin
from urllib.request import Request, urlopen


DEFAULT_HOMEPAGE_URL = "https://tophub.today/"
DEFAULT_FALLBACK_TARGET_URL = "https://tophub.today/n/yjvQDpjobg"
DEFAULT_OUTPUT = "tophub_taobao_tmall_rank_all_item.txt"

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/136.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}


class ExtractionError(RuntimeError):
    """Raised when a required extraction step fails."""


class RankAllItemParser(HTMLParser):
    """Parse rows from the latest jc rank-all-item table."""

    def __init__(self) -> None:
        super().__init__()
        self.in_target_div = False
        self.target_div_depth = 0
        self.capture_rows = False
        self.in_row = False
        self.current_cell_index = -1
        self.in_item_link = False
        self.in_desc_div = False

        self.current_rank: list[str] = []
        self.current_item: list[str] = []
        self.current_desc: list[str] = []
        self.current_url = ""
        self.items: list[dict[str, str]] = []

    @staticmethod
    def _class_tokens(attrs: list[tuple[str, str | None]]) -> set[str]:
        class_value = dict(attrs).get("class") or ""
        return set(class_value.split())

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        classes = self._class_tokens(attrs)

        if (
            tag == "div"
            and not self.in_target_div
            and {"jc", "rank-all-item"}.issubset(classes)
            and "history-content" not in classes
            and "snapshot-content" not in classes
        ):
            self.in_target_div = True
            self.target_div_depth = 1
            return

        if self.in_target_div and tag == "div":
            self.target_div_depth += 1

        if not self.in_target_div:
            return

        if tag == "tr":
            self.in_row = True
            self.current_cell_index = -1
            self.current_rank = []
            self.current_item = []
            self.current_desc = []
            self.current_url = ""
            return

        if not self.in_row:
            return

        if tag == "td":
            self.current_cell_index += 1
            return

        if tag == "a" and self.current_cell_index == 2:
            self.in_item_link = True
            self.current_url = html.unescape(attrs_dict.get("href") or "")
            return

        if (
            tag == "div"
            and self.current_cell_index == 2
            and "item-desc" in classes
        ):
            self.in_desc_div = True

    def handle_endtag(self, tag: str) -> None:
        if self.in_target_div and tag == "div":
            self.target_div_depth -= 1
            if self.in_desc_div and self.in_row:
                self.in_desc_div = False
            if self.target_div_depth == 0:
                self.in_target_div = False
            return

        if not self.in_target_div:
            return

        if tag == "a":
            self.in_item_link = False
            return

        if tag == "tr" and self.in_row:
            rank = clean_text("".join(self.current_rank)).rstrip(".")
            item = clean_text("".join(self.current_item))
            desc = clean_text("".join(self.current_desc))
            if rank and item:
                self.items.append(
                    {
                        "rank": rank,
                        "item": item,
                        "desc": desc,
                        "url": self.current_url,
                    }
                )

            self.in_row = False
            self.current_cell_index = -1
            self.in_item_link = False
            self.in_desc_div = False

    def handle_data(self, data: str) -> None:
        if not (self.in_target_div and self.in_row):
            return

        if self.current_cell_index == 0:
            self.current_rank.append(data)
        elif self.in_item_link:
            self.current_item.append(data)
        elif self.in_desc_div:
            self.current_desc.append(data)


def fetch_html(url: str, timeout: int = 30) -> str:
    request = Request(url, headers=REQUEST_HEADERS)
    with urlopen(request, timeout=timeout) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="ignore")


def clean_text(value: str) -> str:
    text = re.sub(r"<[^>]+>", " ", value)
    text = html.unescape(text)
    text = text.replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize_for_match(value: str) -> str:
    return re.sub(r"\s+", "", clean_text(value))


def iter_target_candidates(homepage_html: str) -> Iterable[str]:
    # 从首页所有 /n/{id} 链接里筛出包含“淘宝/天猫/热销总榜”语义上下文的候选页。
    pattern = re.compile(r'href="([^"]*(?:/n/[A-Za-z0-9]+)[^"]*)"', re.IGNORECASE)
    for match in pattern.finditer(homepage_html):
        href = match.group(1)
        start = max(0, match.start() - 2500)
        end = min(len(homepage_html), match.end() + 2500)
        snippet = homepage_html[start:end]
        normalized = normalize_for_match(snippet)
        if "淘宝" in normalized and "天猫" in normalized and "热销总榜" in normalized:
            yield urljoin(DEFAULT_HOMEPAGE_URL, html.unescape(href))


def find_target_page_urls(homepage_html: str, fallback_url: str) -> list[str]:
    urls: list[str] = []

    if fallback_url:
        # 备用直链优先放入，确保首页结构变化时仍可尝试抓取。
        urls.append(fallback_url)

    for candidate in iter_target_candidates(homepage_html):
        if candidate not in urls:
            # 去重后追加动态发现的候选页，提升命中率。
            urls.append(candidate)

    return urls


def extract_row_items(html_source: str) -> list[dict[str, str]]:
    row_pattern = re.compile(
        r"<tr>\s*"
        r"<td[^>]*>\s*(\d+)\.\s*</td>.*?"
        r'<td[^>]*class="[^"]*\bal\b[^"]*"[^>]*>.*?</td>.*?'
        r'<td[^>]*class="[^"]*\bal\b[^"]*"[^>]*>.*?'
        r"<div>\s*<a href=\"([^\"]+)\"[^>]*>(.*?)</a>\s*</div>\s*"
        r'<div class="item-desc">(.*?)</div>.*?'
        r"</td>",
        re.IGNORECASE | re.DOTALL,
    )

    items: list[dict[str, str]] = []
    for match in row_pattern.finditer(html_source):
        items.append(
            {
                "rank": match.group(1),
                "item": clean_text(match.group(3)),
                "desc": clean_text(match.group(4)),
                "url": html.unescape(match.group(2)),
            }
        )

    if items:
        items.sort(key=lambda item: int(item["rank"]))

    return items


def extract_items(page_html: str) -> list[dict[str, str]]:
    # 首先锁定最新榜单块（排除 history/snapshot），避免提取到历史快照数据。
    block_start = page_html.find('<div class="jc rank-all-item">')
    if block_start < 0:
        raise ExtractionError('Cannot find class="jc rank-all-item" in target page.')

    block_end_candidates = [
        idx
        for idx in (
            page_html.find('<div class="jc rank-all-item history-content"', block_start),
            page_html.find('<div class="jc rank-all-item snapshot-content', block_start),
        )
        if idx > block_start
    ]
    block_end = min(block_end_candidates) if block_end_candidates else len(page_html)
    latest_block_html = page_html[block_start:block_end]

    # 优先使用正则快速提取，性能更好。
    items = extract_row_items(latest_block_html)
    if items:
        return items

    # Fallback 1: scan the full page in case the block boundary changed.
    items = extract_row_items(page_html)
    if items:
        return items

    # Fallback: use HTMLParser if the row HTML changes but the block still exists.
    # 当行结构变化导致正则失效时，使用更稳健的结构化解析兜底。
    parser = RankAllItemParser()
    parser.feed(latest_block_html)
    parser.close()

    if parser.items:
        parser.items.sort(key=lambda item: int(item["rank"]))
        return parser.items

    raise ExtractionError('No rows extracted from class="jc rank-all-item".')


def build_output_text(source_url: str, items: list[dict[str, str]]) -> str:
    lines = [
        "淘宝 · 天猫热销总榜",
        f"来源页面: {source_url}",
        '提取范围: class="jc rank-all-item"',
        f"总条目数: {len(items)}",
        "",
    ]

    for item in items:
        lines.extend(
            [
                f"#{item['rank']}",
                f"ITEM: {item['item']}",
                f"DESC: {item['desc']}",
                f"URL: {item['url']}",
                "",
            ]
        )

    return "\n".join(lines).rstrip() + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract TopHub Taobao/Tmall ranking items into a text file."
    )
    parser.add_argument(
        "--homepage-url",
        default=DEFAULT_HOMEPAGE_URL,
        help=f"Homepage URL to inspect. Default: {DEFAULT_HOMEPAGE_URL}",
    )
    parser.add_argument(
        "--fallback-target-url",
        default=DEFAULT_FALLBACK_TARGET_URL,
        help=(
            "Fallback page URL used when homepage matching cannot locate the "
            "Taobao/Tmall hot-sales ranking."
        ),
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT,
        help=f"Output text file path. Default: {DEFAULT_OUTPUT}",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output_path = Path(args.output).expanduser().resolve()
    tried_urls: list[str] = []

    try:
        homepage_html = fetch_html(args.homepage_url)
        candidate_urls = find_target_page_urls(
            homepage_html=homepage_html,
            fallback_url=args.fallback_target_url,
        )
        if not candidate_urls:
            raise ExtractionError("No candidate target URLs found.")

        target_url = ""
        items: list[dict[str, str]] | None = None
        last_error: Exception | None = None

        for candidate_url in candidate_urls:
            # 逐个候选 URL 尝试抓取，任一成功即停止重试。
            tried_urls.append(candidate_url)
            try:
                page_html = fetch_html(candidate_url)
                extracted_items = extract_items(page_html)
            except Exception as exc:  # noqa: BLE001
                # 记录最后一次错误，便于全部失败时输出诊断信息。
                last_error = exc
                continue

            target_url = candidate_url
            items = extracted_items
            break

        if not target_url or items is None:
            tried_display = ", ".join(tried_urls) if tried_urls else "(none)"
            detail = f"{last_error}" if last_error else "unknown error"
            raise ExtractionError(
                f"Failed to extract rows from all candidate URLs. "
                f"Tried: {tried_display}. Last error: {detail}"
            )

        output_text = build_output_text(target_url, items)

        output_path.write_text(output_text, encoding="utf-8")

    except Exception as exc:  # noqa: BLE001
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    print(f"Target page: {target_url}")
    print(f"Extracted items: {len(items)}")
    print(f"Output file: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
