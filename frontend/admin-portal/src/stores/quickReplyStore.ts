import { create } from 'zustand';
import { quickReplyService } from '../services/quickReply.service';
import { getGlobalMessage } from '../utils/message';

interface Category {
  id: string;
  name: string;
  isGlobal: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  _count: { replies: number };
}

interface Reply {
  id: string;
  categoryId: string;
  content: string;
  isGlobal: boolean;
  isActive: boolean;
  sortOrder: number;
  usageCount: number;
  favoriteCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  isFavorited: boolean;
  category: Category;
  hasPersonalPreference?: boolean; // ✅ 是否有个人偏好
  creatorId?: string; // ✅ 创建者ID，用于权限判断
}

interface QuickReplyState {
  // 分类
  categories: Category[];
  selectedCategoryId: string | null;
  loadingCategories: boolean;

  // 快捷回复
  replies: Reply[];
  totalReplies: number;
  currentPage: number;
  pageSize: number;
  loading: boolean;

  // 排序筛选
  sortBy: 'usageCount' | 'favoriteCount' | 'lastUsedAt';
  onlyFavorites: boolean;
  activeTab: 'all' | 'favorites' | 'usage';
  isActiveFilter: boolean | null; // 启用状态筛选：true=启用, false=未启用, null=全部

  // Actions
  fetchCategories: () => Promise<void>;
  fetchReplies: (page: number) => Promise<void>;
  setSelectedCategory: (categoryId: string | null) => void;
  setSortBy: (sortBy: 'usageCount' | 'favoriteCount' | 'lastUsedAt') => void;
  setActiveTab: (tab: 'all' | 'favorites' | 'usage') => void;
  setIsActiveFilter: (isActive: boolean | null) => void;
  toggleOnlyFavorites: () => void;
  toggleFavorite: (replyId: string) => Promise<void>;
  incrementUsage: (replyId: string) => Promise<void>;
  createReply: (data: any) => Promise<void>;
  updateReply: (replyId: string, data: any) => Promise<void>;
  deleteReply: (replyId: string) => Promise<void>;
  createCategory: (data: any) => Promise<void>;
  updateCategory: (categoryId: string, data: any) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
}

export const useQuickReplyStore = create<QuickReplyState>((set, get) => ({
  categories: [],
  selectedCategoryId: null,
  loadingCategories: false,

  replies: [],
  totalReplies: 0,
  currentPage: 1,
  pageSize: 20,
  loading: false,

  sortBy: 'favoriteCount',
  onlyFavorites: false,
  activeTab: 'all',
  isActiveFilter: null,

  fetchCategories: async () => {
    try {
      set({ loadingCategories: true });
      const data = await quickReplyService.getCategories();
      console.log('获取到的分类数据:', data);
      set({ categories: data });
      // 自动选择第一个分类（仅在还没有选中分类时）
      if (data && data.length > 0 && !get().selectedCategoryId) {
        set({ selectedCategoryId: data[0].id });
        // 自动加载第一个分类的回复
        setTimeout(() => {
          get().fetchReplies(1);
        }, 100);
      }
    } catch (error) {
      console.error('获取分类失败:', error);
    } finally {
      set({ loadingCategories: false });
    }
  },

  fetchReplies: async (page: number = 1) => {
    try {
      set({ loading: true });
      const state = get();
      const { selectedCategoryId, sortBy, activeTab, pageSize, isActiveFilter } = state;
      
      // 根据标签页设置筛选条件（直接使用 activeTab，不依赖 onlyFavorites 状态）
      const shouldFilterFavorites = activeTab === 'favorites';
      const shouldSortByUsage = activeTab === 'usage';
      
      // 在收藏或使用频率标签页时，不使用分类筛选
      const categoryId = (shouldFilterFavorites || shouldSortByUsage) 
        ? undefined 
        : (selectedCategoryId || undefined);
      
      // 确保 onlyFavorites 只在对应标签页时为 true
      const onlyFavorites = activeTab === 'favorites';
      
      // 根据标签页决定排序方式
      let finalSortBy = sortBy;
      if (shouldSortByUsage) {
        finalSortBy = 'usageCount';
      }
      
      console.log('fetchReplies 参数:', {
        categoryId,
        sortBy: finalSortBy,
        onlyFavorites,
        isActive: isActiveFilter,
        activeTab,
        page,
        pageSize,
        'state.onlyFavorites': state.onlyFavorites,
      });
      
      // 构建查询参数：只传递 true 值，不传递 false 值，避免 axios 序列化问题
      const queryParams: any = {
        categoryId,
        sortBy: finalSortBy,
        page,
        pageSize,
      };
      
      // 只传递 true 值，不传递 false 值
      if (onlyFavorites) {
        queryParams.onlyFavorites = true;
      }
      
      // 处理 isActive：null 需要转换为字符串 'null'，以便后端识别
      // 在快捷回复管理页面，如果 isActiveFilter 是 undefined，默认只查询启用的（保持向后兼容）
      // 在客服工作台等使用场景，应该只查询启用的回复
      if (isActiveFilter === null) {
        queryParams.isActive = 'null';
      } else if (isActiveFilter !== undefined) {
        queryParams.isActive = isActiveFilter;
      } else {
        // undefined 表示默认行为：只查询启用的回复（用于客服工作台等场景）
        queryParams.isActive = true;
      }
      
      const data = await quickReplyService.getReplies(queryParams);

      console.log('fetchReplies 返回数据:', data);

      // 处理响应数据 - 确保得到正确的分页数据
      let replyData: any[] = [];
      if (data && data.data) {
        replyData = data.data;
      } else if (Array.isArray(data)) {
        replyData = data;
      }

      // 去重：先根据 id 去重，再根据内容去重（双重保险）
      // 第一层：根据 id 去重
      const uniqueRepliesById = new Map();
      replyData.forEach((reply: any) => {
        if (!uniqueRepliesById.has(reply.id)) {
          uniqueRepliesById.set(reply.id, reply);
        } else {
          console.warn('发现重复的 id:', reply.id, reply.content);
        }
      });
      let deduplicatedReplies = Array.from(uniqueRepliesById.values());

      // 第二层：根据内容去重（防止数据库中有相同内容但不同 id 的重复数据）
      const uniqueRepliesByContent = new Map();
      deduplicatedReplies.forEach((reply: any) => {
        const contentKey = reply.content?.trim() || '';
        if (!uniqueRepliesByContent.has(contentKey)) {
          uniqueRepliesByContent.set(contentKey, reply);
        } else {
          console.warn('发现重复的内容:', reply.id, reply.content);
          // 保留使用次数更高的，如果使用次数相同，保留 id 更小的（更早创建的）
          const existing = uniqueRepliesByContent.get(contentKey);
          if (reply.usageCount > existing.usageCount) {
            uniqueRepliesByContent.set(contentKey, reply);
          } else if (reply.usageCount === existing.usageCount && reply.id < existing.id) {
            uniqueRepliesByContent.set(contentKey, reply);
          }
        }
      });
      deduplicatedReplies = Array.from(uniqueRepliesByContent.values());

      console.log('去重前数量:', replyData.length, '去重后数量:', deduplicatedReplies.length);

      set({
        replies: deduplicatedReplies,
        totalReplies: data?.pagination?.total || deduplicatedReplies.length,
        currentPage: page,
      });
    } catch (error) {
      console.error('获取快捷回复失败:', error);
      // 出错时也设置为空数组
      set({
        replies: [],
        totalReplies: 0,
        currentPage: page,
        loading: false,
      });
    } finally {
      set({ loading: false });
    }
  },

  setSelectedCategory: (categoryId: string | null) => {
    console.log('setSelectedCategory:', categoryId);
    const state = get();
    // 选择分类时，确保重置筛选条件（确保是 'all' 标签页）
    set({ 
      selectedCategoryId: categoryId, 
      currentPage: 1,
      activeTab: 'all', // 选择分类时，强制设置为 'all'
      onlyFavorites: false, // 重置收藏筛选
      isActiveFilter: null, // 重置启用状态筛选为"全部"
    });
    // 不在这里调用 fetchReplies，让 useEffect 统一处理，避免重复请求
  },

  setSortBy: (sortBy: 'usageCount' | 'favoriteCount' | 'lastUsedAt') => {
    set({ sortBy, currentPage: 1 });
    get().fetchReplies(1);
  },

  setIsActiveFilter: (isActive: boolean | undefined) => {
    set({ isActiveFilter: isActive, currentPage: 1 });
    get().fetchReplies(1);
  },

  setActiveTab: (tab: 'all' | 'favorites' | 'usage') => {
    const state = get();
    // 更新标签页和筛选状态
    set({ 
      activeTab: tab,
      onlyFavorites: tab === 'favorites',
      currentPage: 1,
    });
    // 立即加载数据
    // 如果是切换到"全部"标签页，且有选中的分类，则加载该分类的回复
    // 如果是切换到"收藏"或"使用频率"，则直接加载（不需要分类）
    setTimeout(() => {
      get().fetchReplies(1);
    }, 0);
  },

  toggleOnlyFavorites: () => {
    set((state) => ({
      onlyFavorites: !state.onlyFavorites,
      currentPage: 1,
    }));
    get().fetchReplies(1);
  },

  toggleFavorite: async (replyId: string) => {
    try {
      await quickReplyService.toggleFavorite(replyId);
      // 更新回复列表中的收藏状态
      set((state) => ({
        replies: state.replies.map((reply) => {
          if (reply.id === replyId) {
            return {
              ...reply,
              isFavorited: !reply.isFavorited,
              favoriteCount: reply.isFavorited
                ? reply.favoriteCount - 1
                : reply.favoriteCount + 1,
            };
          }
          return reply;
        }),
      }));
      getGlobalMessage().success('收藏状态已更新');
    } catch (error) {
      console.error('收藏失败:', error);
      getGlobalMessage().error('操作失败');
    }
  },

  incrementUsage: async (replyId: string) => {
    try {
      await quickReplyService.incrementUsage(replyId);
      // 更新回复列表中的使用次数和最后使用时间
      set((state) => ({
        replies: state.replies.map((reply) => {
          if (reply.id === replyId) {
            return {
              ...reply,
              usageCount: reply.usageCount + 1,
              lastUsedAt: new Date().toISOString(),
            };
          }
          return reply;
        }),
      }));
    } catch (error) {
      console.error('记录使用失败:', error);
    }
  },

  createReply: async (data: any) => {
    try {
      await quickReplyService.createReply(data);
      get().fetchReplies(1);
    } catch (error) {
      console.error('创建快捷回复失败:', error);
      throw error;
    }
  },

  updateReply: async (replyId: string, data: any) => {
    try {
      await quickReplyService.updateReply(replyId, data);
      get().fetchReplies(get().currentPage);
    } catch (error) {
      console.error('更新快捷回复失败:', error);
      throw error;
    }
  },

  deleteReply: async (replyId: string) => {
    try {
      await quickReplyService.deleteReply(replyId);
      get().fetchReplies(get().currentPage);
    } catch (error) {
      console.error('删除快捷回复失败:', error);
      throw error;
    }
  },

  createCategory: async (data: any) => {
    try {
      await quickReplyService.createCategory(data);
      get().fetchCategories();
    } catch (error) {
      console.error('创建分类失败:', error);
      throw error;
    }
  },

  updateCategory: async (categoryId: string, data: any) => {
    try {
      await quickReplyService.updateCategory(categoryId, data);
      get().fetchCategories();
    } catch (error) {
      console.error('更新分类失败:', error);
      throw error;
    }
  },

  deleteCategory: async (categoryId: string) => {
    try {
      await quickReplyService.deleteCategory(categoryId);
      get().fetchCategories();
    } catch (error) {
      console.error('删除分类失败:', error);
      throw error;
    }
  },

}));
