import request from './request'; // 假设这是你封装好的 axios 实例

/**
 * 获取所有工作簿列表
 * @returns Promise<Array> [{ _id, name, createTime }]
 */
export const getWorkbookList = () => {
  return request({
    url: '/workbooks',
    method: 'get'
  });
};

/**
 * 新建一个工作簿
 * @param {string} name - 表格名称
 * @returns Promise<Object> { ok, workbookId }
 */
export const createWorkbook = (name:string): Promise<any> => {
  return request({
    url: '/workbooks',
    method: 'post',
    data: { name }
  });
};

/**
 * 获取特定工作簿的所有 Sheet 数据
 * @param {string} workbookId - 工作簿ID
 */
export const getWorkbookDetail = (workbookId:string) => {
  return request({
    url: `/workbook/${workbookId}`,
    method: 'get'
  });
};

/**
 * 删除某个工作簿
 * @param {string} workbookId - 工作簿ID
 */
export const deleteWorkbook = (workbookId:string) => {
  return request({
    url: `/workbook/${workbookId}`,
    method: 'delete'
  });
};