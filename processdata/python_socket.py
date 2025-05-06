import asyncio
import websockets
import json
import subprocess
import sys
import os
import signal
import threading
import uuid
import time

# 导入可视化API模块
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
try:
    from visualization_api import handle_visualization_command, json_serialize
    print("成功导入可视化API模块")
except ImportError as e:
    print(f"警告: 无法导入visualization_api模块: {str(e)}")
    handle_visualization_command = None
    json_serialize = None

print("启动Python脚本运行服务器...")

# 存储运行中的进程
running_processes = {}

# 处理命令执行
async def run_command(websocket, command, script_id=None):
    # 如果没有提供脚本ID，生成一个
    if not script_id:
        script_id = str(uuid.uuid4())
    
    process = None
    try:
        # 在子进程中执行命令
        process = subprocess.Popen(
            command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )
        
        # 存储进程信息
        running_processes[script_id] = {
            'process': process,
            'command': command,
            'start_time': time.time(),
            'status': 'running'
        }
        
        # 实时发送输出
        for line in process.stdout:
            try:
                await websocket.send(json.dumps({
                    'type': 'output',
                    'content': line.strip(),
                    'scriptId': script_id
                }))
            except Exception:
                # 如果发送失败，假定连接已关闭
                break
        
        # 等待进程完成
        process.wait()
        
        # 更新进程状态
        if script_id in running_processes:
            running_processes[script_id]['status'] = 'completed'
        
        # 发送完成状态
        try:
            await websocket.send(json.dumps({
                'type': 'status',
                'status': 'completed',
                'exit_code': process.returncode,
                'scriptId': script_id
            }))
        except Exception:
            # 如果发送失败，忽略错误
            pass
            
        # 移除完成的进程
        if script_id in running_processes:
            del running_processes[script_id]
            
    except Exception as e:
        if process:
            try:
                process.terminate()
            except:
                pass
        
        # 更新进程状态
        if script_id in running_processes:
            running_processes[script_id]['status'] = 'error'
        
        try:
            await websocket.send(json.dumps({
                'type': 'output',
                'content': f"错误: {str(e)}",
                'scriptId': script_id
            }))
            await websocket.send(json.dumps({
                'type': 'status',
                'status': 'error',
                'scriptId': script_id
            }))
        except Exception:
            # 如果发送失败，忽略错误
            pass
        
        # 移除出错的进程
        if script_id in running_processes:
            del running_processes[script_id]

# 发送运行中脚本列表
async def send_script_list(websocket):
    scripts = []
    for script_id, info in running_processes.items():
        scripts.append({
            'id': script_id,
            'command': info['command'],
            'status': info['status'],
            'start_time': info['start_time']
        })
    
    await websocket.send(json.dumps({
        'type': 'script_list',
        'scripts': scripts
    }))

# 处理WebSocket连接
async def handle_connection(websocket):
    print(f"客户端已连接: {websocket.remote_address}")
    try:
        # 连接建立时发送当前运行的脚本列表
        await send_script_list(websocket)
        
        async for message in websocket:
            try:
                data = json.loads(message)
                
                if data['action'] == 'run':
                    script_id = data.get('scriptId', str(uuid.uuid4()))
                    await websocket.send(json.dumps({
                        'type': 'output',
                        'content': f"运行命令: {data['command']}",
                        'scriptId': script_id
                    }))
                    # 异步运行命令
                    asyncio.create_task(run_command(websocket, data['command'], script_id))
                
                elif data['action'] == 'list_scripts':
                    # 发送当前运行的脚本列表
                    await send_script_list(websocket)
                
                elif data['action'] == 'terminate':
                    # 终止特定脚本
                    script_id = data.get('scriptId')
                    if script_id and script_id in running_processes:
                        process_info = running_processes[script_id]
                        process_info['process'].terminate()
                        await websocket.send(json.dumps({
                            'type': 'output',
                            'content': f"已终止命令: {process_info['command']}",
                            'scriptId': script_id
                        }))
                
                elif data['action'] == 'fetch_poets':
                    # 获取诗人列表
                    try:
                        # 尝试导入获取诗人列表的函数
                        sys.path.append(os.path.join(os.path.dirname(__file__)))
                        from wordcloud_api_server import get_poets
                        poets = get_poets()
                        await websocket.send(json.dumps({
                            'type': 'poet_list',
                            'success': True,
                            'poets': poets
                        }))
                    except Exception as e:
                        print(f"获取诗人列表时出错: {str(e)}")
                        await websocket.send(json.dumps({
                            'type': 'poet_list',
                            'success': False,
                            'error': str(e)
                        }))
                
                # 处理可视化数据请求
                elif data['action'] in ['get_emotion_data', 'get_topic_data', 'get_poem_detail']:
                    # 检查是否导入了可视化API模块
                    if handle_visualization_command:
                        # 处理可视化命令
                        result = handle_visualization_command(data)
                        # 使用json_serialize函数处理含有datetime的数据
                        if json_serialize:
                            await websocket.send(json_serialize(result))
                        else:
                            # 如果没有json_serialize函数，尝试使用标准json
                            await websocket.send(json.dumps(result, default=str))
                    else:
                        # 发送错误信息
                        await websocket.send(json.dumps({
                            'type': 'error',
                            'success': False,
                            'message': '可视化API模块未加载'
                        }))
                
            except json.JSONDecodeError:
                await websocket.send(json.dumps({
                    'type': 'output',
                    'content': "错误: 收到无效的JSON数据"
                }))
    except websockets.exceptions.ConnectionClosed:
        print("客户端断开连接")

# 清理所有运行中的进程
def cleanup_processes():
    for script_id, info in list(running_processes.items()):
        try:
            if info['process'].poll() is None:  # 如果进程仍在运行
                info['process'].terminate()
                print(f"已终止进程: {info['command']}")
        except:
            pass
    running_processes.clear()

# 启动WebSocket服务器
async def main():
    # 在localhost的6789端口上启动WebSocket服务器
    server = await websockets.serve(handle_connection, "localhost", 6789)
    print("服务器已启动在 ws://localhost:6789")
    print("现在可以从网页中运行Python脚本了")
    
    try:
        await server.wait_closed()
    finally:
        cleanup_processes()

# 处理信号以优雅退出
def signal_handler(sig, frame):
    print("\n正在关闭服务器...")
    cleanup_processes()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

# 启动服务器
if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n接收到键盘中断，正在关闭...")
        cleanup_processes()