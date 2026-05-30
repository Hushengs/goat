import random
import re
import subprocess
import time
import json
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
        """对连接的手机执行一次更偏中右下安全区域的向上滑动。"""
        screen_width, screen_height = self.get_screen_size(default_y_resolution)
        # 将滑动轨迹限制在中间偏右、偏下的区域，尽量避开边缘和顶部按钮。
        start_x = self.clamp(
            int(screen_width * 0.62) + random.randint(-screen_width // 30, screen_width // 24),
            int(screen_width * 0.4),
            int(screen_width * 0.78),
        )
        end_x = self.clamp(
            start_x + random.randint(-screen_width // 36, screen_width // 28),
            int(screen_width * 0.42),
            int(screen_width * 0.8),
        )
        start_y = self.clamp(
            int(screen_height * 0.8) + y_pianyi + random.randint(-screen_height // 50, screen_height // 45),
            int(screen_height * 0.72),
            int(screen_height * 0.9),
        )
        end_y = self.clamp(
            int(screen_height * 0.48) + y_pianyi + random.randint(-screen_height // 45, screen_height // 36),
            int(screen_height * 0.4),
            int(screen_height * 0.58),
        )
        if end_y >= start_y:
            end_y = max(int(screen_height * 0.38), start_y - random.randint(screen_height // 6, screen_height // 4))
        duration_ms = random.randint(220, 420)

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
        print(
            "已滑动设备 %s: (%s, %s) -> (%s, %s), 耗时 %sms"
            % (self.device_id, start_x, start_y, end_x, end_y, duration_ms)
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