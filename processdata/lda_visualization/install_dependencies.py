import subprocess
import sys

# 需要安装的依赖项
dependencies = [
    "pandas",
    "numpy",
    "matplotlib",
    "scikit-learn",
    "scipy",
    "umap-learn",
    "seaborn"
]

def install_dependencies():
    print("正在安装所需的依赖项...")
    for dep in dependencies:
        print(f"安装 {dep}...")
        subprocess.call([sys.executable, "-m", "pip", "install", dep])
    print("所有依赖项已安装完成！")

if __name__ == "__main__":
    install_dependencies() 