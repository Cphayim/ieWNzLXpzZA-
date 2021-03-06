// pages/store-detail/store-detail.js

/**
 * 商品详情页
 * @Catagory 业务页
 * @Author   Cphayim
 */
import { toast, modal } from '../../utils/layer.js'
import { getGoodsDetail, getHasOrder } from '../../service/store-detail.js'
import config from '../../config.js'
import Auth from '../../service/auth.js'

Page({
  pageName: 'store-detail',

  /**
   * 页面的初始数据
   */
  data: {
    isLoaded: false,
    id: 0,
    detail: {},
    /**
     * 判断是支付类型还是报名类型
     * true 为支付类型
     * false 为报名类型
     */
    needPay: false,
    /**
     * 当前状态
     * 支付类型
     * 0: 即将开始, 1: 立即抢购[已达限购上限、已售罄], 2: 已结束
     * 报名类型
     * 0: 即将开始, 1: 立即报名[已参与、已售罄] 2: 已结束
     */
    currentState: 0,
    // 抢购按钮文字
    buyingStateStr: '',
    // 是否禁用抢购按钮
    disabled: false,
    // 是否显示底部按钮
    isShowBotBtn: false
  },

  /**
   * 初始化
   * @private
   * @method _init
   * @return Promise.state
   */
  _init(isRefresh = false) {
    isRefresh || toast.loading()
    return this._getGoodsDetail()
      .then(() => {
        toast.hide()
        this.setData({ isLoaded: true })
      })
      .catch(err => {
        console.warn(err)
        toast.hide()
      })
  },

  /**
   * 获取商品详情数据
   * @private
   * @method _getGoodsDetail
   * @return Promise.state
   */
  _getGoodsDetail() {
    const { id } = this.data
    return getGoodsDetail(id)
      .then(res => {
        this._getHasOrder()
        const { data } = res
        this.setData({ detail: data }, () => {
          if (data.model) {
            this._initState()
          }
        })
      })
  },

  /**
   * 初始化状态
   * @private
   * @method _initState
   * @return Promise.state
   */
  _initState() {
    return this._setBaseState()
      .then(_ => this._setSubmitBtn())
  },

  /**
   * 设置基本状态
   * @private
   * @method _setBaseState
   * @return Promise.state
   */
  _setBaseState() {
    const { detail } = this.data
    return new Promise((resolve, reject) => {
      this.setData({
        // 判断是支付类型还是报名类型
        needPay: !!detail.model.NeedPay,
        // 当前状态
        currentState: ~~detail.model.ArticleStatus
      }, _ => resolve())
    })
  },

  /**
   * 设置提交按钮
   * @private
   * @method setSubmitBtn
   */
  _setSubmitBtn() {
    // 当前是即将开抢状态
    if (this.data.currentState === 0) {
      // 设置抢购倒计时
      this._setCountDown('begin')
    }
    // 当前是正在抢购状态
    else if (this.data.currentState === 1) {
      // 设置抢购按钮状态
      if (this.data.needPay) {
        // 支付类型
        this._setPayBtnState()
      } else {
        // 报名类型
        this._setSignBtnState()
      }
      // 设置结束倒计时
      this._setCountDown('end')
    }

    setTimeout(() => this.setData({ isShowBotBtn: true }), 400)
  },

  /**
   * 设置支付类型按钮状态
   * @private
   * @method _setPayBtnState
   */
  _setPayBtnState() {
    const { detail } = this.data
    let key = detail.model.ProductId ? 'product' : 'model'

    // 已购买数超过上限(达到限购数)
    if (detail.purchased >= detail[key].BuyMaxCount) {
      this.setData({ buyingStateStr: '已达限购上限', disabled: true })
    }
    // 是否有剩余数量
    else if (detail.canBuyCount) {
      this.setData({ buyingStateStr: '立即抢购', disabled: false })
    }
    // 售罄 
    else {
      this.setData({ buyingStateStr: '已售罄', disabled: true })
    }
  },

  /**
   * 设置报名类型按钮状态
   * @private
   * @method _setSignBtnState
   */
  _setSignBtnState() {
    const { detail } = this.data
    // 已报名过
    if (detail.hasJoin) {
      this.setData({ buyingStateStr: '已参与', disabled: true })
    }
    // 是否有剩余数量
    else if (detail.canBuyCount) {
      this.setData({ buyingStateStr: '一键报名', disabled: false })
    }
    // 售罄 
    else {
      this.setData({ buyingStateStr: '已达人数上限', disabled: true })
    }
  },

  /**
   * 设置开始/结束倒计时
   * @private
   * @method _setCountDown
   * @param {string} key ['begin' | 'end']
   */
  _setCountDown(key = 'begin') {
    const time = (key === 'end') ?
      this.data.detail.model.EndTime : this.data.detail.model.BeginTime

    clearInterval(this.data.timer)
    const timestamp = ~~(new Date(time).getTime() / 1000)
    let countDown = timestamp - ~~(Date.now() / 1000)

    const t = setInterval(() => {
      if (countDown <= 0) {
        // 重新加载数据
        this.init()
        return clearInterval(t)
      }
      this.setData({ [key + 'CountDown']: countDown })
      countDown--
    }, 1000)

    this.setData({
      timer: t
    })
  },

  /**
   * 获取是否有未完成订单
   * @private
   * @method _getHasOrder
   */
  _getHasOrder() {
    return getHasOrder(this.data.id)
      .then(({ data }) => {
        if (data && typeof data === 'number') {
          modal.confirm({
            content: '您有一笔未完成订单，是否进入',
            cancelText: '不进入',
            confirmText: '进入'
          }).then(flag => {
            if (!flag) return
            wx.navigateTo({
              url: `${config.pageOpt.getPageUrl('order-detail')}?id=${data}`,
            })
          })
        }
      })
  },

  /**
   * 提交
   * 进入下单页面
   * @method submit
   * @param {object} e
   */
  submit(e) {
    if (this.data.currentState !== 1 || this.data.disabled) return
    // 判断是支付类型还是报名类型
    let url = ''
    if (this.data.needPay) {
      url = `${config.pageOpt.getPageUrl('submit-order')}?id=${this.data.id}`
    } else {
      url = `${config.pageOpt.getPageUrl('submit-register')}?id=${this.data.id}`
    }
    wx.navigateTo({ url })
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 获取参数 id
    const { id } = options
    this.data.id = id
    // 没有 id 返回上一级
    if (!id) {
      return modal
        .alert({ content: config.error.ERR_PARAM })
        .then(_ => {
          wx.navigateBack({ delta: 1 })
        })
    }

    if (config.pageOpt.getNeedAuth(this.pageName)) {
      const auth = new Auth()
      auth.validate()
        .then(res => this._init())
    } else {
      this._init()
    }
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    if (!this.data.isLoaded) return
    wx.startPullDownRefresh({})
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    // 清空定时器
    if (this.data.timer) {
      clearInterval(this.data.timer)
    }
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    setTimeout(() => {
      this._init(true).then(_ => wx.stopPullDownRefresh())
    }, config.refreshDelay)

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: wx.getExtConfigSync().tanantName,
      path: config.pageOpt.getShareUrl(this.pageName)
    }
  }
})