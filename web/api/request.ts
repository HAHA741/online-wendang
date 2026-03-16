import axios from 'axios';

// 创建 axios 实例
const service = axios.create({
  // 这里的 URL 应该对应你 Node.js 后端的地址
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081', 
  timeout: 10000, // 请求超时时间
  headers: {
    'Content-Type': 'application/json'
  }
});

// --- 请求拦截器 ---
service.interceptors.request.use(
  (config) => {
    // 如果你有 Token 认证逻辑，可以在这里添加
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers['Authorization'] = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    console.error('请求错误:', error);
    return Promise.reject(error);
  }
);

// --- 响应拦截器 ---
service.interceptors.response.use(
  (response) => {
    // 直接返回数据部分，省去在页面里写 res.data 的麻烦
    const res = response.data;
    
    // 你可以根据后端约定的状态码在这里做统一处理
    // 比如：if (res.code !== 200) { ... 提示错误 ... }
    
    return res;
  },
  (error) => {
    // 统一处理 HTTP 状态码错误
    let message = '网络连接异常';
    if (error.response) {
      switch (error.response.status) {
        case 400: message = '请求参数错误'; break;
        case 404: message = '接口地址不存在'; break;
        case 500: message = '服务器内部错误'; break;
        default: message = error.message;
      }
    }
    
    // 这里可以接入你 UI 框架的 Message 提示
    console.error('响应报错:', message);
    
    return Promise.reject(error);
  }
);

export default service;