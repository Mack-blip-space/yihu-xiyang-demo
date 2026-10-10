/* 法学院内容编辑入口。所有示例仅用于展示框架，不构成正式法律答复。
 * 可修改标题、摘要和 sections；id 保持唯一。审核后填 author/reviewer/source。
 */
window.YIHU_CONTENT = {
  version: 1,
  categories: ['全部', '反诈课堂', '典型案例', '常见问答', '公益诉讼'],
  articles: [
    { id: 'phone', category: '反诈课堂', title: '接到陌生来电，先别急着转账', summary: '从一通“熟人电话”开始，认识身边的风险。', label: '今日课堂', minutes: '约 2 分钟', icon: 'phone', color: 'peach', status: '待法学院审核', author: '', reviewer: '', source: '', sections: [
      { heading: '这通电话，您遇到过吗？', text: '【虚构演示情景】电话里的人自称是熟人，说急需用钱，并要求马上转账。这样的场景将用于展示漫画与语音课堂。' },
      { heading: '这里将放什么内容？', text: '由法学院同学补充：情景对话、风险识别要点、核实方式和求助渠道。正式发布前完成内容审核。' },
      { heading: '您也遇到了类似的事情？', text: '可以体验下方的线索记录流程。本原型不会报警，也不会向任何机构发送信息。' }
    ]},
    { id: 'investment', category: '典型案例', title: '“高回报养老项目”背后的风险', summary: '案例模板：事情经过、处理结果与风险提醒。', label: '案例示例', minutes: '约 3 分钟', icon: 'shield', color: 'sage', status: '待补充真实案例', author: '', reviewer: '', source: '', sections: [
      { heading: '案例背景', text: '【虚构演示情景】一位长辈收到养老投资邀请，对项目的收益承诺感到疑惑。此处用于演示案例阅读页面，并非项目已收集的真实案例。' },
      { heading: '事情经过与处理结果', text: '待法学院同学提供经过匿名处理的真实案例，补充侵权类型、救济过程、处理结果及可核验来源。' },
      { heading: '给我们的提醒', text: '待审核内容：用容易理解的语言归纳案例启示，明确具体情境与适用范围。' }
    ]},
    { id: 'evidence', category: '常见问答', title: '记录问题时，可以准备哪些材料？', summary: '看看材料清单，也可以先描述事情经过。', label: '常见问题', minutes: '约 2 分钟', icon: 'file', color: 'sand', status: '待法学院审核', author: '', reviewer: '', source: '', sections: [
      { heading: '先试着记录事情经过', text: '演示表单提供时间、金额、经过和材料附件几个位置。不清楚的信息可以注明“不清楚”。' },
      { heading: '材料清单示例', text: '页面预留聊天截图、交易凭证、合同或其他相关材料的位置。正式取证要求、原件保存方式与证据效力说明，由法学院同学补充。' },
      { heading: '提交前再看一遍', text: '请使用虚构信息体验。本原型的附件只保存在本浏览器，不上传至机构。' }
    ]},
    { id: 'public', category: '公益诉讼', title: '公益诉讼，怎样参与？', summary: '认识项目提出的多方协作路径。', label: '项目研究', minutes: '约 3 分钟', icon: 'scale', color: 'sage', status: '研究方案，待审核', author: '', reviewer: '', source: '本项目研究申报书（研究构想）', sections: [
      { heading: '项目研究的方向', text: '项目书提出“检察机关主导、社会组织补充、私人参与”的多元机制，关注老年人财产权益保护。这里展示的是研究构想。' },
      { heading: '从线索到协作', text: '原型展示“记录线索—整理材料—了解后续渠道”的流程。具体启动条件、参与资格和办理程序，待法学院同学核实后编写。' },
      { heading: '每个问题都能提起公益诉讼吗？', text: '本原型不作法律判断。公益诉讼、支持起诉、普通民事诉讼等不同渠道的适用边界，将由法学院团队提供正式说明。' }
    ]},
    { id: 'family', category: '常见问答', title: '我不太会操作，家人可以帮忙吗？', summary: '了解当前原型里的家人协助功能。', label: '使用帮助', minutes: '约 1 分钟', icon: 'users', color: 'peach', status: '功能说明', author: '', reviewer: '', source: '', sections: [
      { heading: '可以一起填写', text: '在“我的”页面开启“家人协助模式”，可在同一台设备上代为记录。表单会标明由家人协助填写。' },
      { heading: '由长辈确认', text: '最后一步可以一起核对信息。本原型不提供法律授权、远程控制或跨设备信息同步。' }
    ]},
    { id: 'rules', category: '公益诉讼', title: '法令与政策 · 内容更新位置', summary: '留给法学院同学维护的法规资料栏目。', label: '资料模板', minutes: '待填充', icon: 'book', color: 'sand', status: '内容待提供', author: '', reviewer: '', source: '', sections: [
      { heading: '法规资料模板', text: '每条资料需要填写：法规名称、相关条文、发布机关、有效状态、生效日期、官方原文链接和通俗解读。' },
      { heading: '审核后再发布', text: '当前未收录正式法令条文，也不展示未经核实的政策进展。此页用于确认内容呈现方式。' }
    ]}
  ],
  issueTypes: [
    { id: '诈骗疑虑', icon: 'phone', note: '电话、短信或网络转账' },
    { id: '投资理财', icon: 'shield', note: '养老投资、收益承诺' },
    { id: '消费合同', icon: 'file', note: '购物、服务或合同问题' },
    { id: '财产被占', icon: 'home', note: '存款、房屋等财产问题' },
    { id: '数字权益', icon: 'lock', note: '账号、信息或线上扣费' },
    { id: '不太清楚', icon: 'chat', note: '没关系，先说说发生了什么' }
  ]
};
