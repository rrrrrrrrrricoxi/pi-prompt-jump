#!/usr/bin/env python3
"""Real Pi CLI/PTY smoke test; local deterministic provider, no credentials/network.
Usage: python3 tests/terminal-smoke.py /path/to/installed/pi-coding-agent
Requires POSIX Python 3 and an already installed Pi 1.3.0. No installs performed.
"""
import fcntl
import json
import os
from pathlib import Path
import pty
import re
import select
import signal
import struct
import sys
import tempfile
import termios
import time

PACKAGE = Path(__file__).resolve().parent.parent
EXTENSION = Path(os.environ.get('PI_SMOKE_PACKAGE_DIR', PACKAGE)).resolve()
HOST = Path(sys.argv[1] if len(sys.argv) > 1 else os.environ.get('PI_INSTALL_ROOT', str(Path(os.environ.get('PI_RUNTIME', str(Path.home() / '.local/state/pi-config/current/runtime'))) / 'node_modules/@earendil-works/pi-coding-agent'))).resolve()
assert json.loads((HOST / 'package.json').read_text())['version'] == '1.3.0'

class Terminal:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.snapshot_file = self.directory / 'snapshot.json'
        self.agent = self.directory / 'agent'
        self.agent.mkdir()
        (self.agent / 'settings.json').write_text(json.dumps({
            'branchSummary': {'skipPrompt': True}, 'cacheWarming': 'off',
            'compaction': {'enabled': False}, 'retry': {'enabled': False},
        }))
        self.sessions = self.directory / 'sessions'
        self.sessions.mkdir()
        self.raw = bytearray()
        self.sequence = 0
        self.instance = None
        env = {key: os.environ[key] for key in ('PATH', 'LANG') if key in os.environ}
        env.update(HOME=directory, TERM='xterm-256color', COLORTERM='truecolor',
                   PI_CODING_AGENT_DIR=str(self.agent), PI_OFFLINE='1', PI_TELEMETRY='0',
                   PI_SKIP_VERSION_CHECK='1', PI_IMAGE_PROTOCOL='none', PI_PROGRAM_STATUS='0',
                   PI_SMOKE_SNAPSHOT=str(self.snapshot_file))
        args = ['node', '--require', str(PACKAGE / 'tests/deny-network.cjs'),
                str(HOST / 'dist/bundle/cli.js'), '--offline', '--no-approve',
                '--no-extensions', '--extension', str(EXTENSION / 'index.ts'),
                '--extension', str(PACKAGE / 'tests/fixture-provider.ts'),
                '--no-skills', '--no-prompt-templates', '--no-context-files',
                '--no-themes', '--no-mcp', '--no-tools', '--tui-mode', 'fullscreen',
                '--session-dir', str(self.sessions), '--model', 'smoke-fixture/fixture']
        if os.environ.get('PI_COMPACT_RENDERER_PATH'):
            args[args.index('--extension'):args.index('--extension')] = ['--extension', str(Path(os.environ['PI_COMPACT_RENDERER_PATH']).resolve() / 'index.ts')]
        self.pid, self.fd = pty.fork()
        if self.pid == 0:
            os.chdir(directory)
            os.execvpe(args[0], args, env)
        self.resize(80, 24)

    def resize(self, columns, rows):
        fcntl.ioctl(self.fd, termios.TIOCSWINSZ, struct.pack('HHHH', rows, columns, 0, 0))
        os.kill(self.pid, signal.SIGWINCH)

    def drain(self, duration=0.08):
        end = time.monotonic() + duration
        while time.monotonic() < end:
            if select.select([self.fd], [], [], max(0, end-time.monotonic()))[0]:
                try:
                    data = os.read(self.fd, 65536)
                except OSError:
                    raise AssertionError('Pi CLI exited unexpectedly: ' + self.text()[-3000:])
                if not data:
                    raise AssertionError('Pi CLI closed its terminal: ' + self.text()[-3000:])
                self.raw.extend(data)

    def text(self):
        text = self.raw.decode('utf-8', errors='replace')
        text = re.sub(r'\x1b\][\s\S]*?(?:\x07|\x1b\\)', '', text)
        return re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]', '', text)

    def send(self, data):
        os.write(self.fd, data.encode() if isinstance(data, str) else data)
        self.drain()

    def paste(self, text):
        self.send('\x1b[200~' + text + '\x1b[201~')

    def command(self, text):
        self.paste(text)
        self.send('\r')
        self.drain(0.15)

    def snapshot(self, timeout=5):
        self.send('\x1b[24~')  # Test-only F12 observer; does not alter the editor.
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            if self.snapshot_file.exists():
                try:
                    result = json.loads(self.snapshot_file.read_text())
                except json.JSONDecodeError:
                    continue
                if result['instance'] != self.instance or result['sequence'] > self.sequence:
                    self.instance = result['instance']
                    self.sequence = result['sequence']
                    return result
            self.drain(0.03)
        raise AssertionError('Timed out waiting for terminal observer: ' + self.text()[-3000:])

    def until(self, predicate, timeout=8):
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            value = self.snapshot()
            if predicate(value):
                return value
            self.drain(0.05)
        raise AssertionError('Terminal state did not satisfy assertion: ' + json.dumps(value))

    def quit(self):
        self.paste('/quit')
        os.write(self.fd, b'\r')
        end = time.monotonic() + 8
        while time.monotonic() < end:
            pid, status = os.waitpid(self.pid, os.WNOHANG)
            if pid:
                self.pid = None
                assert os.waitstatus_to_exitcode(status) == 0, status
                return
            if select.select([self.fd], [], [], 0.05)[0]:
                try:
                    self.raw.extend(os.read(self.fd, 65536))
                except OSError:
                    pass  # A closed PTY can precede the exit status by one iteration.
        raise AssertionError('Pi did not exit after /quit')

    def close(self):
        if self.pid is not None:
            try:
                os.kill(self.pid, signal.SIGKILL)  # Only this harness's isolated child.
            except ProcessLookupError:
                pass
            os.waitpid(self.pid, 0)
        os.close(self.fd)

with tempfile.TemporaryDirectory(prefix='pi-prompt-jump-terminal-') as directory:
    terminal = Terminal(directory)
    try:
        terminal.drain(3)
        state = terminal.snapshot()
        assert state['mounted'] and state['roots'] == 1, state
        print('PASS: actual fullscreen CLI startup and strip mount')
        for index in range(1, 4):
            terminal.command(f'Synthetic prompt {index}')
            growing = terminal.until(lambda s: len(s['anchors']) == index and not s['idle'])
            assert growing['following'], growing
            if index == 3:
                # Wait until the newest prompt is above the follow-end viewport;
                # earlier, prev correctly targets the preceding prompt instead.
                terminal.until(lambda s: not s['idle'] and s['top'] > s['anchors'][-1]['row'])
                terminal.send('\x1b[1;4A')
                paused = terminal.snapshot()
                assert not paused['following'] and paused['top'] == paused['anchors'][-1]['row'], paused
            state = terminal.until(lambda s: len(s['anchors']) == index and s['idle'])
            if index == 3:
                assert state['top'] == paused['top'] and not state['following'], state
                terminal.command('/prompt-jump back')
                state = terminal.snapshot()
            assert state['following'], state
        assert [a['label'] for a in state['anchors']] == [f'Synthetic prompt {i}' for i in range(1, 4)]
        print('PASS: three local fixture responses stream and remain in follow-end mode')

        terminal.send('\x1b[1;4A')  # Alt+Shift+Up, terminal xterm encoding.
        state = terminal.snapshot()
        assert state['top'] == state['anchors'][2]['row'] and not state['following'], state
        terminal.send('\x1b[1;4A')
        state = terminal.snapshot()
        assert state['top'] == state['anchors'][1]['row'], state
        terminal.send('\x1b[1;4B')
        state = terminal.snapshot()
        assert state['top'] == state['anchors'][2]['row'], state
        terminal.command('/prompt-jump back')
        state = terminal.snapshot()
        assert state['top'] == state['anchors'][1]['row'], state
        print('PASS: real modified-key routing and back position')

        before = state['top']
        terminal.command('/prompt-jump list')
        terminal.send('\x1b')
        assert terminal.snapshot()['top'] == before
        terminal.command('/prompt-jump list')
        terminal.send('\r')  # Default first prompt.
        state = terminal.snapshot()
        assert state['top'] == state['anchors'][0]['row'], state
        print('PASS: prompt picker selection and Escape cancellation')

        terminal.send('\x1b[6~')  # PageDown places viewport inside first response.
        state = terminal.snapshot()
        assert state['anchors'][0]['row'] < state['top'] < state['anchors'][1]['row'], state
        terminal.paste('focus-marker')
        before = terminal.snapshot()
        terminal.send('\x1b[<0;5;1M\x1b[<0;5;1m')  # SGR left press/release on strip.
        state = terminal.snapshot()
        assert state['top'] == state['anchors'][0]['row'], state
        assert state['focus'] == before['focus'] and state['editor'] == 'focus-marker', state
        terminal.send('\x15')  # Clear unsubmitted draft.
        print('PASS: actual mouse routing jumps without stealing editor focus/text')

        for columns, rows in [(40, 12), (100, 36), (80, 24)]:
            terminal.resize(columns, rows)
            terminal.drain(0.2)
            terminal.command('/prompt-jump last')
            state = terminal.snapshot()
            assert state['mounted'] and state['roots'] == 1 and state['viewportHeight'] > 0, state
            assert state['top'] == state['anchors'][-1]['row'], state
        print('PASS: actual SIGWINCH resize and recalculated jump positions')

        terminal.command('/sticky-prompt off')
        assert not terminal.snapshot()['mounted']
        preference = terminal.agent / 'pi-prompt-jump.json'
        assert json.loads(preference.read_text())['enabled'] is False
        terminal.command('/sticky-prompt on')
        assert terminal.snapshot()['mounted']
        assert json.loads(preference.read_text())['enabled'] is True
        terminal.command('/reload')
        terminal.drain(1)
        state = terminal.snapshot()
        assert state['mounted'] and state['roots'] == 1, state
        print('PASS: on/off persistence and real /reload without duplicate layout roots')

        terminal.command('/name Original smoke session')
        old_session = state['sessionId']
        terminal.command('/new')
        state = terminal.until(lambda s: s['sessionId'] != old_session)
        assert state['mounted'] and len(state['anchors']) == 0, state
        terminal.command('Synthetic new-session prompt')
        state = terminal.until(lambda s: s['idle'] and len(s['anchors']) == 1)
        assert state['anchors'][0]['label'] == 'Synthetic new-session prompt', state
        print('PASS: /new session switch clears old anchors and accepts new prompts')
        terminal.command('/resume')
        terminal.paste('Original smoke session')
        terminal.send('\r')
        state = terminal.until(lambda s: s['sessionId'] == old_session)
        assert state['mounted'] and len(state['anchors']) == 3, state
        terminal.command('/prompt-jump last')
        state = terminal.snapshot()
        assert state['top'] == state['anchors'][-1]['row'], state
        print('PASS: actual /resume picker restores the original session and correct anchors')

        terminal.command('/tree')
        terminal.send('\x1b[A')
        terminal.send('\x1b[A')
        terminal.send('\r')
        state = terminal.until(lambda s: len(s['anchors']) == 2 and s['editor'] == '')
        assert state['mounted'], state
        terminal.command('/prompt-jump back')
        assert 'No prompt/return position in that direction.' in terminal.text()[-5000:]
        terminal.command('/prompt-jump end')
        assert terminal.snapshot()['following']
        print('PASS: actual /tree branch navigation drops old anchors/bookmark; end resumes following')

        assert 'SMOKE TEST: network access is forbidden' not in terminal.text()
        assert 'Extension Errors' not in terminal.text()
        entries = [json.loads(line) for path in terminal.sessions.rglob('*.jsonl')
                   for line in path.read_text().splitlines()]
        assistants = [e['message'] for e in entries if e.get('type') == 'message'
                      and e['message']['role'] == 'assistant']
        assert len(assistants) == 4, len(assistants)
        assert all(m['provider'] == 'smoke-fixture' and m['usage']['totalTokens'] == 0 for m in assistants)
        print('PASS: every response came from local fixture; zero model tokens; network guard stayed silent')

        # Exercise a long session in the actual CLI, not just the component benchmark.
        import datetime
        timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
        long_file = terminal.directory / 'long-synthetic-session.jsonl'
        lines = [{'type': 'session', 'version': 3, 'id': 'smoke-long-session',
                  'timestamp': timestamp, 'cwd': str(terminal.directory)}]
        parent = None
        def append(entry):
            global parent
            entry.update(id=f'{len(lines):08x}', parentId=parent, timestamp=timestamp)
            parent = entry['id']
            lines.append(entry)
        append({'type': 'model_change', 'provider': 'smoke-fixture', 'modelId': 'fixture'})
        for index in range(1000):
            append({'type': 'message', 'message': {'role': 'user', 'content': f'Long synthetic prompt {index + 1}', 'timestamp': 0}})
            append({'type': 'message', 'message': {
                'role': 'assistant', 'content': [{'type': 'text', 'text': 'Synthetic long-session response.\n\n' * 20}],
                'api': 'smoke-fixture-stream', 'provider': 'smoke-fixture', 'model': 'fixture',
                'timestamp': 0, 'stopReason': 'stop', 'usage': {
                    'input': 0, 'output': 0, 'cacheRead': 0, 'cacheWrite': 0, 'totalTokens': 0,
                    'cost': {'input': 0, 'output': 0, 'cacheRead': 0, 'cacheWrite': 0, 'total': 0},
                }}})
        long_file.write_text(''.join(json.dumps(line) + '\n' for line in lines))
        terminal.command('/import ' + str(long_file))
        terminal.send('\r')  # Confirm replacement of this harness's synthetic session.
        state = terminal.until(lambda s: len(s['anchors']) == 1000, timeout=15)
        assert state['mounted'] and state['roots'] == 1, state
        terminal.command('/prompt-jump list')
        terminal.send('\r')
        state = terminal.snapshot()
        assert state['top'] == state['anchors'][0]['row'], state
        terminal.command('/prompt-jump last')
        state = terminal.snapshot()
        assert state['top'] == state['anchors'][-1]['row'], state
        terminal.resize(40, 12)
        terminal.drain(0.3)
        terminal.command('/prompt-jump last')
        state = terminal.snapshot()
        assert state['top'] == state['anchors'][-1]['row'], state
        print('PASS: actual CLI import, picker, first/last jumps and resize with 1,000 prompts / 2,000 messages')
        assert 'SMOKE TEST: network access is forbidden' not in terminal.text()
        assert 'Extension Errors' not in terminal.text()
        terminal.quit()
        print('PASS: /quit shuts down the actual CLI cleanly with exit status zero')
    except Exception:
        print('FAIL terminal tail:', terminal.text()[-4000:])
        raise
    finally:
        terminal.close()
