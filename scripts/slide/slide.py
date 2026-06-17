import random
import re
import subprocess
import time
import json
import hashlib
from pathlib import Path


# region agent log
DEBUG_LOG_PATH = Path(__file__).resolve().parents[2] / "debug-c65e53.log"


def debug_log(run_id, hypothesis_id, location, message, data):
    payload = {
        "sessionId": "c65e53",
        "runId": run_id,
        "hypothesisId": hypothesis_id,
        "location": location,
        "message": message,
        "data": data,
        "timestamp": int(time.time() * 1000),
    }
    with DEBUG_LOG_PATH.open("a", encoding="utf-8") as log_file:
        log_file.write(json.dumps(payload, ensure_ascii=False) + "\n")


# endregion


class slide_guaji:
    def __init__(self):
        self.device_id = None

    @staticmethod
    def clamp(value, min_value, max_value):
        return max(min_value, min(value, max_value))

    def build_swipe_path(self, screen_width, screen_height, y_pianyi=0):
        """生成一条尽量避开广告热区的纵向滑动轨迹。"""
        # 广告位通常更容易出现在中右区域，优先走中左到中间的竖向通道。
        lane_ratios = (0.34, 0.42, 0.5)
        lane_ratio = random.choice(lane_ratios)
        base_x = int(screen_width * lane_ratio)
        start_x = self.clamp(
            base_x + random.randint(-screen_width // 40, screen_width // 40),
            int(screen_width * 0.22),
            int(screen_width * 0.58),
        )
        end_x = self.clamp(
            start_x + random.randint(-screen_width // 60, screen_width // 60),
            int(screen_width * 0.2),
            int(screen_width * 0.6),
        )
        start_y = self.clamp(
            int(screen_height * 0.84) + y_pianyi + random.randint(-screen_height // 55, screen_height // 40),
            int(screen_height * 0.74),
            int(screen_height * 0.92),
        )
        end_y = self.clamp(
            int(screen_height * 0.28) + y_pianyi + random.randint(-screen_height // 55, screen_height // 42),
            int(screen_height * 0.18),
            int(screen_height * 0.42),
        )
        if end_y >= start_y:
            end_y = max(int(screen_height * 0.2), start_y - random.randint(screen_height // 4, screen_height // 3))
        duration_ms = random.randint(280, 460)
        return start_x, start_y, end_x, end_y, duration_ms

    def perform_swipe(self, start_x, start_y, end_x, end_y, duration_ms):
        subprocess.run(
            [
                "adb",
                "-s",
                self.device_id,
                "shell",
                "input",
                "swipe",
                str(start_x),
                str(start_y),
                str(end_x),
                str(end_y),
                str(duration_ms),
            ],
            check=False,
        )

    def get_screen_fingerprint(self):
        """获取当前页面截图指纹，用于判断滑动后页面是否真的发生变化。"""
        result = subprocess.run(
            ["adb", "-s", self.device_id, "exec-out", "screencap", "-p"],
            capture_output=True,
            check=False,
        )
        if result.returncode != 0 or not result.stdout:
            return None
        screenshot_bytes = result.stdout.replace(b"\r\n", b"\n")
        return hashlib.md5(screenshot_bytes).hexdigest()

    def perform_back(self):
        """广告页吞手势时，退回上一层页面。"""
        subprocess.run(
            ["adb", "-s", self.device_id, "shell", "input", "keyevent", "4"],
            check=False,
        )

    def select_device(self):
        """选择需要连接的设备"""
        # region agent log
        debug_log("initial", "H3", "scripts/slide/slide.py:31", "select_device_enter", {})
        # endregion
        result = subprocess.run(
            ["adb", "devices"],
            capture_output=True,
            text=True,
            check=False,
        )
        # region agent log
        debug_log(
            "initial",
            "H4",
            "scripts/slide/slide.py:40",
            "adb_devices_result",
            {"returncode": result.returncode, "stdout": result.stdout, "stderr": result.stderr},
        )
        # endregion
        totalstring = result.stdout or ""
        pattern = r"(\b(?:[0-9]{1,3}(?:\.[0-9]{1,3}){3}(?::[0-9]+)?|[A-Za-z0-9]{8,})\b)\s*device\b"
        devicelist = re.findall(pattern, totalstring)
        devicenum = len(devicelist)
        if devicenum == 0:
            # region agent log
            debug_log("initial", "H4", "scripts/slide/slide.py:52", "no_device_detected", {})
            # endregion
            print("当前无设备连接电脑,请检查设备连接情况!")
            return None
        if devicenum == 1:
            print("当前有一台设备连接，编号:%s." % devicelist[0])
            return devicelist[0]

        print("当前存在多台设备连接! 输入数字选择对应设备:")
        dictdevice = {}
        for i, device_id in enumerate(devicelist, start=1):
            result = subprocess.run(
                ["adb", "-s", device_id, "shell", "getprop", "ro.product.device"],
                capture_output=True,
                text=True,
                check=False,
            )
            model_name = result.stdout.strip() or "unknown"
            print("%s:%s---%s" % (i, device_id, model_name))
            dictdevice[i] = device_id

        while True:
            num = input("请输入设备序号: ").strip()
            if num.isdigit() and int(num) in dictdevice:
                return dictdevice[int(num)]
            print("输入不正确，请重新输入：")

    def get_screen_size(self, default_y_resolution=2400):
        """读取手机分辨率，读取失败时使用默认值。"""
        result = subprocess.run(
            ["adb", "-s", self.device_id, "shell", "wm", "size"],
            capture_output=True,
            text=True,
            check=False,
        )
        output = "%s\n%s" % (result.stdout, result.stderr)
        match = re.search(r"(?:Physical|Override) size:\s*(\d+)x(\d+)", output)
        if match:
            return int(match.group(1)), int(match.group(2))
        return 1080, default_y_resolution

    def slide_once(self, y_pianyi=0, default_y_resolution=2400):
        """对连接的手机执行一次尽量避开广告热区的向上滑动。"""
        screen_width, screen_height = self.get_screen_size(default_y_resolution)
        before_fingerprint = self.get_screen_fingerprint()
        start_x, start_y, end_x, end_y, duration_ms = self.build_swipe_path(
            screen_width, screen_height, y_pianyi
        )
        self.perform_swipe(start_x, start_y, end_x, end_y, duration_ms)
        print(
            "已滑动设备 %s: (%s, %s) -> (%s, %s), 耗时 %sms"
            % (self.device_id, start_x, start_y, end_x, end_y, duration_ms)
        )
        time.sleep(0.8)
        after_fingerprint = self.get_screen_fingerprint()
        if before_fingerprint and after_fingerprint and before_fingerprint == after_fingerprint:
            print("检测到页面未变化，疑似广告页拦截滑动，补一次返回。")
            self.perform_back()
            time.sleep(1.2)
            return
        # 广告页面可能吞掉第一下手势，补一次更靠左的长距离滑动提高翻页成功率。
        if random.random() < 0.35:
            time.sleep(random.uniform(0.15, 0.35))
            backup_start_x, backup_start_y, backup_end_x, backup_end_y, backup_duration_ms = self.build_swipe_path(
                screen_width, screen_height, y_pianyi
            )
            backup_start_x = self.clamp(
                min(start_x, backup_start_x) - screen_width // 14,
                int(screen_width * 0.16),
                int(screen_width * 0.46),
            )
            backup_end_x = self.clamp(
                backup_start_x + random.randint(-screen_width // 80, screen_width // 80),
                int(screen_width * 0.14),
                int(screen_width * 0.48),
            )
            self.perform_swipe(
                backup_start_x,
                backup_start_y,
                backup_end_x,
                backup_end_y,
                max(backup_duration_ms, 360),
            )
            print(
                "广告页兜底滑动 %s: (%s, %s) -> (%s, %s), 耗时 %sms"
                % (
                    self.device_id,
                    backup_start_x,
                    backup_start_y,
                    backup_end_x,
                    backup_end_y,
                    max(backup_duration_ms, 360),
                )
            )

    def guaji(self, y_pianyi=0, y_resolution=2400):
        """每隔5-10秒随机等待后，向上滑动一次手机屏幕。"""
        self.device_id = self.select_device()
        if not self.device_id:
            return False

        print("开始随机滑动，按 Ctrl+C 停止。")
        try:
            while True:
                wait_seconds = random.randint(5, 8)
                print("等待 %s 秒后执行滑动..." % wait_seconds)
                time.sleep(wait_seconds)
                self.slide_once(y_pianyi, y_resolution)
        except KeyboardInterrupt:
            print("已手动停止滑动脚本。")
            return True


if __name__ == "__main__":
    # region agent log
    debug_log("initial", "H3", "scripts/slide/slide.py:158", "main_entry", {"argv_mode": "direct_script"})
    # endregion
    slide = slide_guaji()
    slide.guaji(0, 2240)  # 参数第一个是y的偏移值，第二个是默认y分辨率