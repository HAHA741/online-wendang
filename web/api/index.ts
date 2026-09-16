import request from './request'; // 假设这是你封装好的 axios 实例
import type { Sheet } from '@fortune-sheet/core';

interface CreateWorkbookResponse {
  ok: boolean;
  workbookId: string;
}

interface ReplaceWorkbookSheetsResponse {
  ok: boolean;
  workbookId: string;
  revision: string;
  sheets: Sheet[];
}

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
export const createWorkbook = (name:string): Promise<CreateWorkbookResponse> => {
  return request({
    url: '/workbooks',
    method: 'post',
    data: { name }
  }) as unknown as Promise<CreateWorkbookResponse>;
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

/**
 * 使用导入结果替换指定工作簿的全部 Sheet
 * @param {string} workbookId - 工作簿ID
 * @param {Array} sheets - FortuneSheet 工作表数据
 */
export const replaceWorkbookSheets = (
  workbookId: string,
  sheets: Sheet[],
): Promise<ReplaceWorkbookSheetsResponse> => {
  return request({
    url: `/workbook/${workbookId}/sheets`,
    method: 'put',
    data: { sheets }
  }) as unknown as Promise<ReplaceWorkbookSheetsResponse>;
};
