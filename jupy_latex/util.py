""" JupyterLab LaTex : live LaTeX editing for JupyterLab """

import subprocess, sys

from tornado import gen
from tornado.process import Subprocess, CalledProcessError

@gen.coroutine
def run_command_sync(cmd):
    """
    Run a command using the synchronous `subprocess.run`.
    The asynchronous `run_command_async` should be preferred,
    but does not work on Windows, so use this as a fallback.

    Parameters
    ----------
    iterable
        An iterable of command-line arguments to run in the subprocess.

    Returns
    -------
    A tuple containing the (return code, stdout)
    """
    try:
        process = subprocess.run(cmd, stdout=subprocess.PIPE)
    except subprocess.CalledProcessError as err:
        pass
    code = process.returncode
    out = process.stdout.decode('utf-8')
    return (code, out)

@gen.coroutine
def run_command_async(cmd):
    """
    Run a command using the asynchronous `tornado.process.Subprocess`.

    Parameters
    ----------
    iterable
        An iterable of command-line arguments to run in the subprocess.

    Returns
    -------
    A tuple containing the (return code, stdout)
    """
    process = Subprocess(cmd,
                         stdout=Subprocess.STREAM,
                         stderr=Subprocess.STREAM)
    try:
        yield process.wait_for_exit()
    except CalledProcessError as err:
        pass
    code = process.returncode
    out = yield process.stdout.read_until_close()
    return (code, out.decode('utf-8'))

# Windows does not support async subprocesses, so
# use a synchronous system calls.
if sys.platform == 'win32':
    run_command = run_command_sync
else:
    run_command = run_command_async
